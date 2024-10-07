import styles from "./chat.module.css";

interface SpeechInputProps {
    onReceiveText: (text: string) => void;
}

declare global {
    interface Window {
      SpeechRecognition: any;
      webkitSpeechRecognition: any;
    }
}

const SpeechInput = ({ onReceiveText }: SpeechInputProps) => {
    const startListening = () => {
      if (typeof window !== 'undefined') {  // check client-side
          const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
          recognition.lang = 'vi-VN';
  
          recognition.onstart = () => {
          };
  
          recognition.onresult = (event) => {
            const speechToText = event.results[0][0].transcript;
            onReceiveText(speechToText);
          };
  
          recognition.onend = () => {
          };
  
          recognition.onerror = (event) => {
            console.error("Speech recognition error detected: ", event.error);
          };
  
          recognition.start();
      }
    };
  
    return (
      <div>
        <button type="button" className={styles.button} onClick={startListening} >
          <p>Tim kiem bang giong noi</p>
        </button>
      </div>
    );
  };
  
  export default SpeechInput;