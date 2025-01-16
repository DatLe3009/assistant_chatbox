"use client";

import React, { useState, useEffect, useRef } from "react";
import 'regenerator-runtime/runtime'; // Thêm dòng này
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import styles from "./chat.module.css";
import { AssistantStream } from "openai/lib/AssistantStream";
import Markdown from "react-markdown";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane } from '@fortawesome/free-solid-svg-icons';

import { useTextToSpeech } from "../hooks/useTextToSpeech";

// @ts-expect-error - no types for this yet
import { AssistantStreamEvent } from "openai/resources/beta/assistants/assistants";
import { RequiredActionFunctionToolCall } from "openai/resources/beta/threads/runs/runs";
import SpeechInput from "./speechInput";

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
  // isUserDetected: boolean;  
};

const Chat = ({
  functionCallHandler = () => Promise.resolve(""), // default to return empty string
  // isUserDetected,
}: ChatProps) => {
  const [userInput, setUserInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [inputDisabled, setInputDisabled] = useState(false);
  const [threadId, setThreadId] = useState("");

  const [topic, setTopic] = useState(null); // topic: subject, rules, schedule

  const [isChatting, setIsChatting] = useState(false);

  const {
    finalTranscript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition
  } = useSpeechRecognition();

  const [processing, setProcessing] = useState(false); // Trạng thái xử lý câu hỏi
  const [timeoutId, setTimeoutId] = useState(null);

  // Xử lý câu hỏi khi có finalTranscript
  useEffect(() => {
    if (finalTranscript && !processing) {
      resetTranscript(); // Đặt lại transcript sau khi lưu
      handleQuestionProcessing(finalTranscript);
      resetTimeout();
    } else if (finalTranscript && processing) {
      console.log("đang xử lí không nhận mới:",finalTranscript)
    }
  }, [finalTranscript, processing]);

  useEffect(() => {
    // Tự động bắt đầu ghi âm khi component được mount
    handleStartListening();
  }, []); // Chạy một lần khi component được mount

  // Bắt đầu lắng nghe
  useEffect(() => {
    console.log("listening: ", listening);
    console.log("processing: ", processing);
    if (listening && !processing) {
      SpeechRecognition.startListening({ continuous: true });
      resetTimeout();
    }
  }, [listening]);

  const resetTimeout = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    const id = setTimeout(() => {
      setIsChatting(false);
      setMessages([]); // Xóa lịch sử chat
    }, 180000); // Set timeout mới 
    setTimeoutId(id);
  };

  // Tự động reset trạng thái nếu không có khuôn mặt trong 60 + 10 giây
  // useEffect(() => {
  //   let timeout;
  //   if (!isUserDetected && isChatting) {
  //     timeout = setTimeout(() => {
  //       setIsChatting(false);
  //       setMessages([]); // Xóa lịch sử chat
  //     }, 60000);
  //   }
  //   return () => clearTimeout(timeout); // Dọn dẹp timeout
  // }, [isUserDetected, isChatting]);

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
  const handleTextDone = async (content, snapshot) => {
    console.log(content.value);
    await speakText(content.value); // Phát âm thanh
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

  const handleQuestionProcessing = async (userInput: string) => {
    setProcessing(true);
    // SpeechRecognition.stopListening(); // Dừng ghi âm

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
      await speakText(opening_statement); // Phát âm thanh
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

      await speakText(statement); // Phát âm thanh
    } else if (isChatting && topic) {
      if (userInput.toLowerCase() === "đổi chủ đề") {
        setTopic(null);
        let statement = "Bạn muốn hỏi về nội dung môn học, nội quy, hay thời khóa biểu?";
        setMessages((prevMessages) => [
          ...prevMessages,
          { role: "assistant", text: statement },
        ]);
        await speakText(statement); // Phát âm thanh
      } else {
        if (!userInput.trim()) return;
        await sendMessage(userInput, topic);
        setMessages((prevMessages) => [
          ...prevMessages,
          { role: "user", text: userInput },
        ]);
        setUserInput("");
        setInputDisabled(true);
        scrollToBottom();
      }
    } else {
      setProcessing(false);
    }
  };

  
  
  // Kiểm tra hỗ trợ nhận diện giọng nói
  // if (!browserSupportsSpeechRecognition) {
  //   return <span>Browser doesn't support speech recognition.</span>;
  // }

  // Các hàm điều khiển
  const handleStartListening = () => {
    SpeechRecognition.startListening({ continuous: true });
  };

  const handleStopListening = () => {
    SpeechRecognition.stopListening();
  };

  const { speakText } = useTextToSpeech(listening, handleStartListening, handleStopListening, resetTranscript, setProcessing);

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
            disabled={inputDisabled}
          >
            <FontAwesomeIcon icon={faPaperPlane} size="lg"/>
          </button>
          {/* <SpeechInput onReceiveText={handleQuestionProcessing} isListening={isListening} setIsListening={setIsListening} isTalking={isTalking}/> */}
        </div>
      </form>
    </div>
  );
};

export default Chat;
