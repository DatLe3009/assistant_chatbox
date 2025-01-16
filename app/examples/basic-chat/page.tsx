"use client";

import React, { useState } from "react";
import styles from "../shared/page.module.css";

import Chat from "../../components/chat";
import RobotViewer from "../../components/robot-viewer";
import FaceDetection from "../../components/face-detection";



const Home = () => {

  // const [isUserDetected, setIsUserDetected] = useState(false);

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        {/* <div className={styles.column}>
          <RobotViewer 
            isListening={isListening}
            isTalking={isTalking}
            isUserDetected={isUserDetected}
          />
          <FaceDetection
            setIsUserDetected={setIsUserDetected} 
          />
        </div> */}
        <div className={styles.chatContainer}>
          <div className={styles.chat}>
            <Chat 
              // isUserDetected={isUserDetected}
            />
          </div>
        </div>
      </div>
    </main>
  );
};

export default Home;
