"use client";
import React, { useState } from "react";
import styles from "../shared/page.module.css";

import Chat from "../../components/chat";
import FileViewer from "../../components/file-viewer";

const FileSearchPage = () => {
  // const [isUserDetected, setIsUserDetected] = useState(false);

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <div className={styles.column}>
          <FileViewer />
        </div>
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

export default FileSearchPage;
