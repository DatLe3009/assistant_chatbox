"use client";

import React, { useState } from "react";
import styles from "../shared/page.module.css";

import Chat from "../../components/chat";
import RobotViewer from "../../components/robot-viewer";
import FaceDetection from "../../components/face-detection";



const Home = () => {
  const [isListening, setIsListening] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  const [isUserDetected, setIsUserDetected] = useState(false);

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <div className={styles.column}>
          {/* <RobotViewer 
            isListening={isListening}
            isTalking={isTalking}
            isUserDetected={isUserDetected}
          /> */}
          <FaceDetection
            setIsUserDetected={setIsUserDetected} 
          />
        </div>
        <div className={styles.chatContainer}>
          <div className={styles.chat}>
            <Chat 
              isListening={isListening}
              isTalking={isTalking}
              isUserDetected={isUserDetected}
              setIsListening={setIsListening}
              setIsTalking={setIsTalking}
            />
          </div>
        </div>
      </div>
    </main>
  );
};

export default Home;
