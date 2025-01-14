"use client";

import React, { useState, useEffect, useRef } from "react";
import styles from "./chat.module.css";
import { AssistantStream } from "openai/lib/AssistantStream";
import Markdown from "react-markdown";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane } from '@fortawesome/free-solid-svg-icons';

import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "../hooks/useSpeechSynthesis";
import { useTextToSpeech } from "../hooks/useTextToSpeech";

// @ts-expect-error - no types for this yet
import { AssistantStreamEvent } from "openai/resources/beta/assistants/assistants";
import { RequiredActionFunctionToolCall } from "openai/resources/beta/threads/runs/runs";

type MessageProps = {
  role: "user" | "assistant" | "code";
  text: string;
};

const UserMessage = ({ text }: { text: string }) => {
  return <div className={styles.userMessage}>{text}</div>;
};

const AssistantMessage = ({ text }: { text: string }) => {
  return (
    <div className={styles.assistantMessage}>
      <Markdown>{text}</Markdown>
    </div>
  );
};

const CodeMessage = ({ text }: { text: string }) => {
  return (
    <div className={styles.codeMessage}>
      {text.split("\n").map((line, index) => (
        <div key={index}>
          <span>{`${index + 1}. `}</span>
          {line}
        </div>
      ))}
    </div>
  );
};

const Message = ({ role, text }: MessageProps) => {
  switch (role) {
    case "user":
      return <UserMessage text={text} />;
    case "assistant":
      return <AssistantMessage text={text} />;
    case "code":
      return <CodeMessage text={text} />;
    default:
      return null;
  }
};

type ChatProps = {
  functionCallHandler?: (
    toolCall: RequiredActionFunctionToolCall
  ) => Promise<string>;
  setIsListening: (listening: boolean) => void;
  setIsTalking: (talking: boolean) => void;
  isListening: boolean;
  isTalking: boolean;
  // isUserDetected: boolean;  
};

const Chat = ({
  functionCallHandler = () => Promise.resolve(""), // default to return empty string
  setIsListening,
  setIsTalking,
  isListening,
  isTalking,
  // isUserDetected,
}: ChatProps) => {
  const [userInput, setUserInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [inputDisabled, setInputDisabled] = useState(false);
  const [threadId, setThreadId] = useState("");

  const [topic, setTopic] = useState(null); // topic: subject, rules, schedule

  const [isVoiceDetected, setIsVoiceDetected] = useState(false);
  const [isChatting, setIsChatting] = useState(false);

  // Tự động reset trạng thái nếu không có âm thanh trong 60 + 10 giây
  useEffect(() => {
    let timeout;
    if (!isVoiceDetected && isChatting && !isTalking) {
      timeout = setTimeout(() => {
        setIsChatting(false);
        setMessages([]); // Xóa lịch sử chat
      }, 10000);
    }
    return () => clearTimeout(timeout); // Dọn dẹp timeout
  }, [isVoiceDetected, isChatting]);

  // automatically scroll to bottom of chat
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // create a new threadID when chat component created
  useEffect(() => {
    const createThread = async () => {
      const res = await fetch(`/api/assistants/threads`, {
        method: "POST",
      });
      const data = await res.json();
      setThreadId(data.threadId);
    };
    createThread();
  }, []);

  const sendMessage = async (text, topic) => {
    const response = await fetch(
      `/api/assistants/threads/${threadId}/messages`,
      {
        method: "POST",
        body: JSON.stringify({
          content: text,
          topic: topic
        }),
      }
    );
    const stream = AssistantStream.fromReadableStream(response.body);
    handleReadableStream(stream);
  };

  const submitActionResult = async (runId, toolCallOutputs) => {
    const response = await fetch(
      `/api/assistants/threads/${threadId}/actions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          runId: runId,
          toolCallOutputs: toolCallOutputs,
        }),
      }
    );
    const stream = AssistantStream.fromReadableStream(response.body);
    handleReadableStream(stream);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!userInput.trim()) return;
    sendMessage(userInput, topic);
    setMessages((prevMessages) => [
      ...prevMessages,
      { role: "user", text: userInput },
    ]);
    setUserInput("");
    setInputDisabled(true);
    scrollToBottom();
  };

  /* Stream Event Handlers */

  // textCreated - create new assistant message
  const handleTextCreated = () => {
    appendMessage("assistant", "");
  };

  // textDelta - append text to last assistant message
  const handleTextDelta = (delta) => {
    if (delta.value != null) {
      appendToLastMessage(delta.value);
    };
    if (delta.annotations != null) {
      annotateLastMessage(delta.annotations);
    }
  };

  //textDone - use  content after done to speak text
  const handleTextDone = (content, snapshot) => {
    console.log(content.value);
    speakText(content.value);
  };

  // imageFileDone - show image in chat
  const handleImageFileDone = (image) => {
    appendToLastMessage(`\n![${image.file_id}](/api/files/${image.file_id})\n`);
  }

  // toolCallCreated - log new tool call
  const toolCallCreated = (toolCall) => {
    if (toolCall.type != "code_interpreter") return;
    appendMessage("code", "");
  };

  // toolCallDelta - log delta and snapshot for the tool call
  const toolCallDelta = (delta, snapshot) => {
    if (delta.type != "code_interpreter") return;
    if (!delta.code_interpreter.input) return;
    appendToLastMessage(delta.code_interpreter.input);
  };

  // handleRequiresAction - handle function call
  const handleRequiresAction = async (
    event: AssistantStreamEvent.ThreadRunRequiresAction
  ) => {
    const runId = event.data.id;
    const toolCalls = event.data.required_action.submit_tool_outputs.tool_calls;
    // loop over tool calls and call function handler
    const toolCallOutputs = await Promise.all(
      toolCalls.map(async (toolCall) => {
        const result = await functionCallHandler(toolCall);
        return { output: result, tool_call_id: toolCall.id };
      })
    );
    setInputDisabled(true);
    submitActionResult(runId, toolCallOutputs);
  };

  // handleRunCompleted - re-enable the input form
  const handleRunCompleted = () => {
    setInputDisabled(false);
  };

  const handleReadableStream = (stream: AssistantStream) => {
    // messages
    stream.on("textCreated", handleTextCreated);
    stream.on("textDelta", handleTextDelta);
    stream.on("textDone", handleTextDone);

    // image
    stream.on("imageFileDone", handleImageFileDone);

    // code interpreter
    stream.on("toolCallCreated", toolCallCreated);
    stream.on("toolCallDelta", toolCallDelta);

    // events without helpers yet (e.g. requires_action and run.done)
    stream.on("event", (event) => {
      if (event.event === "thread.run.requires_action")
        handleRequiresAction(event);
      if (event.event === "thread.run.completed") handleRunCompleted();
    });
  };

  /*
    =======================
    === Utility Helpers ===
    =======================
  */

  const appendToLastMessage = (text) => {
    setMessages((prevMessages) => {
      const lastMessage = prevMessages[prevMessages.length - 1];
      const updatedLastMessage = {
        ...lastMessage,
        text: lastMessage.text + text,
      };
      return [...prevMessages.slice(0, -1), updatedLastMessage];
    });
  };

  const appendMessage = (role, text) => {
    setMessages((prevMessages) => [...prevMessages, { role, text }]);
  };

  const annotateLastMessage = (annotations) => {
    setMessages((prevMessages) => {
      const lastMessage = prevMessages[prevMessages.length - 1];
      const updatedLastMessage = {
        ...lastMessage,
      };
      annotations.forEach((annotation) => {
        if (annotation.type === 'file_path') {
          updatedLastMessage.text = updatedLastMessage.text.replaceAll(
            annotation.text,
            `/api/files/${annotation.file_path.file_id}`
          );
        }
      })
      return [...prevMessages.slice(0, -1), updatedLastMessage];
    });
    
  }

  const handleSpeechText = (userInput: string) => {
    console.log("Nhận giọng nói:", userInput);
    if (!isChatting && userInput.toLowerCase().includes("xin chào robot")) {
      setMessages((prevMessages) => [
        ...prevMessages,
        { role: "user", text: userInput },
      ]);

      const opening_statement = "Xin chào, bạn muốn hỏi về nội dung môn học, nội quy, hay thời khóa biểu?";
      setMessages((prevMessages) => [
        ...prevMessages,
        { role: "assistant", text: opening_statement },
      ]);
      speakText(opening_statement);
      setIsChatting(true);
    } else if (isChatting && !topic) {
      let statement: string = null;
      if (userInput.toLowerCase().includes("nội dung môn học")) {
        setTopic("subject");
        statement = "Bạn đã chọn nội dung môn học. Hãy đặt câu hỏi.";
      } else if (userInput.toLowerCase().includes("nội quy")) {
        setTopic("rules");
        statement = "Bạn đã chọn nội quy. Hãy đặt câu hỏi.";
      } else if (userInput.toLowerCase().includes("thời khóa biểu")) {
        setTopic("schedule");
        statement = "Bạn đã chọn thời khóa biểu. Hãy đặt câu hỏi.";
      } else {
        statement = "Xin lỗi, tôi không hiểu. Bạn có thể chọn nội dung môn học, nội quy, hoặc thời khóa biểu.";
      }
      setMessages((prevMessages) => [
        ...prevMessages,
        { role: "assistant", text: statement },
      ]);
      speakText(statement);
    } else if (isChatting && topic) {
      if (userInput.toLowerCase() === "đổi chủ đề") {
        setTopic(null);
        let statement = "Bạn muốn hỏi về nội dung môn học, nội quy, hay thời khóa biểu?";
        setMessages((prevMessages) => [
          ...prevMessages,
          { role: "assistant", text: statement },
        ]);
        speakText(statement);
      } else {
        if (!userInput.trim()) return;
        sendMessage(userInput, topic);
        setMessages((prevMessages) => [
          ...prevMessages,
          { role: "user", text: userInput },
        ]);
        setUserInput("");
        setInputDisabled(true);
        scrollToBottom();
      }
    }
  };

  const { startListening, stopListening } = useSpeechRecognition(handleSpeechText, setIsListening, isListening, setIsTalking, isTalking, setIsVoiceDetected);
  // const { speakText } = useSpeechSynthesis(isListening, setIsTalking, startListening, stopListening);
  const { speakText } = useTextToSpeech(isListening, setIsTalking, startListening, stopListening);

  // Luôn bật lại micro
  useEffect(() => {
      if (!isListening && !isTalking) {
        startListening(); // Bắt đầu lắng nghe
      }
  }, [isListening, isTalking, startListening]);
  


  return (
    <div className={styles.chatContainer}>
      <div className={styles.messages}>
        {messages.map((msg, index) => (
          <Message key={index} role={msg.role} text={msg.text} />
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form
        onSubmit={handleSubmit}
        className={`${styles.inputForm} ${styles.clearfix}`}
      >
        <input
          type="text"
          className={styles.input}
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="Enter your question"
        />
        <div className={styles.buttonGroup}>
          <button
            type="submit"
            className={styles.button}
            disabled={inputDisabled || isListening || isTalking}
          >
            <FontAwesomeIcon icon={faPaperPlane} size="lg"/>
          </button>
          {/* <SpeechInput onReceiveText={handleSpeechText} isListening={isListening} setIsListening={setIsListening}/> */}
        </div>
      </form>
    </div>
  );
};

export default Chat;
