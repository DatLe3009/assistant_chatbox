"use client";

import React, { useState, useEffect, useRef } from "react";
import 'regenerator-runtime/runtime'; // Thêm dòng này
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import styles from "./chat.module.css";
import { AssistantStream } from "openai/lib/AssistantStream";
import Markdown from "react-markdown";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane } from '@fortawesome/free-solid-svg-icons';
import md5 from 'md5';

import { useTextToSpeech } from "../hooks/useTextToSpeech";

// @ts-expect-error - no types for this yet
import { AssistantStreamEvent } from "openai/resources/beta/assistants/assistants";
import { RequiredActionFunctionToolCall } from "openai/resources/beta/threads/runs/runs";
import SpeechInput from "./speechInput";

declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

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
    // console.log("listening: ", listening);
    // console.log("processing: ", processing);
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
      setTopic(null);
      speakText("Tạm biệt bạn, tôi sẽ kết thúc cuộc trò chuyện.", true);
      setMessages([]); // Xóa lịch sử chat
    }, 60000); // Set timeout mới 
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
    if (isChatting && userInput.toLowerCase().includes("kết thúc cuộc trò chuyện")) {
      setIsChatting(false);
      setTopic(null);
      speakText("Tạm biệt bạn, tôi sẽ kết thúc cuộc trò chuyện.", true);
      setMessages([]); // Xóa lịch sử chat    
    } else if (!isChatting && userInput.toLowerCase().includes("xin chào robot")) {
      setMessages((prevMessages) => [
        ...prevMessages,
        { role: "user", text: "xin chào robot" },
      ]);

      const opening_statement = "Xin chào, bạn muốn hỏi về nội dung môn học, nội quy, hay thời khóa biểu?";
      setMessages((prevMessages) => [
        ...prevMessages,
        { role: "assistant", text: opening_statement },
      ]);
      await speakText(opening_statement, true); // Phát âm thanh
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

      await speakText(statement, true); // Phát âm thanh
    } else if (isChatting && topic) {
      if (userInput.toLowerCase() === "đổi chủ đề") {
        setTopic(null);
        let statement = "Bạn muốn hỏi về nội dung môn học, nội quy, hay thời khóa biểu?";
        setMessages((prevMessages) => [
          ...prevMessages,
          { role: "assistant", text: statement },
        ]);
        await speakText(statement, true); // Phát âm thanh
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

  // option 1
  // const { speakText } = useTextToSpeech(listening, handleStartListening, handleStopListening, resetTranscript, setProcessing);


  // option 2
  const audioRef = useRef(null);
  const audioContextRef = useRef(null);
  const speakText = async (text: string, isKey: boolean = false) => {
      if (listening) handleStopListening();

      try {
          const audio = audioRef.current;

          if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();;
          }

           if (isKey) {
              // Tạo tên tệp bằng hash (md5)
              const fileName = `${md5(text)}.mp3`;
              const audioPath = `/audio/${fileName}`;
              
              // Kiểm tra nếu tệp đã tồn tại trong public/audio
              const responseCheck = await fetch(audioPath, { method: 'HEAD' });
              if (responseCheck.ok) {
                  // Tệp tồn tại, sử dụng đường dẫn cũ
                  audio.src = `http://localhost:3000${audioPath}`;
              } else {
                  // Tệp không tồn tại, yêu cầu API để tạo
                  const response = await fetch('/api/tts', {
                      method: 'POST',
                      headers: {
                          'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({ content: text }),
                  });
  
                  if (!response.ok) throw new Error('Failed to generate audio');
  
                  const audioBlob = await response.blob();
  
                  // Gửi audioBlob và fileName đến API /api/save-audio để lưu
                  const saveResponse = await fetch('/api/save-audio', {
                      method: 'POST',
                      headers: {
                          'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                          fileName,
                          audioBlob: await audioBlob.arrayBuffer().then(buffer => Buffer.from(buffer).toString('base64')), // Chuyển blob sang base64
                      }),
                  });
  
                  if (!saveResponse.ok) throw new Error('Failed to save audio file');
  
                  audio.src = `http://localhost:3000${audioPath}`;
              }
          } else {
            audio.src = `http://localhost:3000/api/tts?content=${encodeURIComponent(
                text
            )}`;
          }


          audio.play().then(() => {
              console.log("Đang phát âm thanh...");

              audio.onended = () => {
                  resetTranscript();
                  new Promise(resolve => setTimeout(resolve, 100)); // 100ms
                  handleStartListening();
                  setProcessing(false);

                  console.log("Kết thúc phát âm thanh, khởi động lại ghi âm...");
                  // setCurrentAudio(null); // Xóa âm thanh hiện tại khi kết thúc
              };
          }).catch(err => {
              console.error("Lỗi khi phát âm thanh:", err);
          });
      } catch (error) {
          console.error('Error calling OpenAI API:', error);
      }
  };

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
      <audio ref={audioRef}></audio>
    </div>
  );
};

export default Chat;
