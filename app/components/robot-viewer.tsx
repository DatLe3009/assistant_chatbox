import React, { useState, useEffect } from "react";
import styles from "./robot-viewer.module.css";

const RobotViewer = ({isListening, isTalking, isSleeping}) => {
  
    return (
      <div className={styles.robotViewer}>
          {isTalking ? <img src="/images/cat-talking.gif" alt="Cat Talking" width="100%" />
        : isListening ? <img src="/images/cat-listening.gif" alt="Cat Listening" width="100%" />
        : isSleeping ? <img src="/images/cat-sleeping.gif" alt="Cat Sleeping" width="100%" />
        : <img src="/images/cat-blinking.gif" alt="Cat Blinking" width="100%" />
    }
      </div>
    );
  };
  
  export default RobotViewer;
  