"use client";

import React, { useState, useEffect, useRef } from "react";
import styles from "./chat.module.css";
import { AssistantStream } from "openai/lib/AssistantStream";
import Markdown from "react-markdown";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane } from '@fortawesome/free-solid-svg-icons';

import SpeechInput from './speechInput';
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";

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
  isUserDetected: boolean;  
};

const Chat = ({
  functionCallHandler = () => Promise.resolve(""), // default to return empty string
  setIsListening,
  setIsTalking,
  isListening,
  isTalking,
  isUserDetected,
}: ChatProps) => {
  const [userInput, setUserInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [inputDisabled, setInputDisabled] = useState(false);
  const [threadId, setThreadId] = useState("");

  const [isChatting, setIsChatting] = useState(false);

  // voice output
  const timeoutId = useRef(null);
  let accumulatedText = ""; 
 
  // Tự động reset trạng thái nếu không có người trong 10 giây
  useEffect(() => {
    let timeout;
    if (!isUserDetected && isChatting && !isTalking) {
      timeout = setTimeout(() => {
        setIsChatting(false);
        setMessages([]); // Xóa lịch sử chat
      }, 10000);
    }
    return () => clearTimeout(timeout); // Dọn dẹp timeout
  }, [isUserDetected, isChatting]);

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

  const sendMessage = async (text) => {
    const response = await fetch(
      `/api/assistants/threads/${threadId}/messages`,
      {
        method: "POST",
        body: JSON.stringify({
          content: text,
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
    sendMessage(userInput);
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
      accumulatedText += delta.value;
      appendToLastMessage(delta.value);
    };
    if (delta.annotations != null) {
      annotateLastMessage(delta.annotations);
    }

    // voice output
    if (timeoutId.current) {
      clearTimeout(timeoutId.current);
    }
    timeoutId.current = setTimeout(() => {
      if (accumulatedText && isCompleteSentence(accumulatedText)) {
        setIsTalking(true);
        const utterance = new SpeechSynthesisUtterance(accumulatedText);
        utterance.lang = 'vi-VN';

        // stop();
        if (recognition.current) {
          recognition.current.abort(); // Dừng ngay lập tức
        }
      
        console.log("Dừng lắng nghe để robot nói")
        utterance.onstart = () => {
          setIsTalking(true);
        };
    
        utterance.onend = () => {
          console.log("Robot đã nói xong, khởi động lại lắng nghe...");
          setIsTalking(false);
          
          // Đảm bảo khởi động lại nhận diện giọng nói
          if (!isListening) {
            start();
            setIsListening(true);
          }
        };

        window.speechSynthesis.speak(utterance);
      }
    }, 3000); 
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

  const isCompleteSentence = (text) => {  
    return /[.!?]\s*$/.test(text);
  };

  const handleSpeechText = (userInput: string) => {
    // setUserInput(text);
    console.log("Nhận giọng nói:", userInput);
    if (!isChatting && userInput.toLowerCase() === "xin chào robot") {
      setMessages((prevMessages) => [
        ...prevMessages,
        { role: "user", text: userInput },
      ]);

      const opening_statement = "Xin chào, tôi có thể giúp gì cho bạn.";
      setMessages((prevMessages) => [
        ...prevMessages,
        { role: "assistant", text: opening_statement },
      ]);
      setIsTalking(true);
      const utterance = new SpeechSynthesisUtterance(opening_statement);
      utterance.lang = 'vi-VN';

      stop();
      console.log("Dừng lắng nghe để robot nói câu mở đầu");
      utterance.onstart = () => {
        setIsTalking(true);
      };
  
      utterance.onend = () => {
        setIsTalking(false);
        start();
        console.log("Lắng nghe trở lại sau câu mở đầu");
      };

      window.speechSynthesis.speak(utterance);  
      setIsChatting(true);
    } else if (isChatting) {
      if (!userInput.trim()) return;
      sendMessage(userInput);
      setMessages((prevMessages) => [
        ...prevMessages,
        { role: "user", text: userInput },
      ]);
      setUserInput("");
      setInputDisabled(true);
      scrollToBottom();
    }
  };

  const { start, stop, recognition } = useSpeechRecognition(handleSpeechText, isListening, setIsListening, isTalking, setIsTalking);

  // Bật micro khi phát hiện người
  useEffect(() => {
    if (isUserDetected) {
      if (!isListening && !isTalking) {
        start(); // Bắt đầu lắng nghe
      }
    } else {
      if (isListening) {
        stop(); // Dừng lắng nghe
      }
      // if (isTalking) {
      //   window.speechSynthesis.cancel(); // Dừng nói nếu không có người
      // }
    }
  }, [isUserDetected, isListening, isTalking]);
  


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
