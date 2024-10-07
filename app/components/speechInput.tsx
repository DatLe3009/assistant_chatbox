import styles from "./chat.module.css";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMicrophone, faStopCircle } from '@fortawesome/free-solid-svg-icons';

interface SpeechInputProps {
    onReceiveText: (text: string) => void;
    isListening: boolean;
    setIsListening: (isListening: boolean) => void;
}

declare global {
    interface Window {
      SpeechRecognition: any;
      webkitSpeechRecognition: any;
    }
}

const SpeechInput = ({ onReceiveText, isListening, setIsListening }: SpeechInputProps) => {
    const startListening = () => {
      if (typeof window !== 'undefined') {  // check client-side
          const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
          recognition.lang = 'vi-VN';
  
          recognition.onstart = () => {
            setIsListening(true);
          };
  
          recognition.onresult = (event) => {
            const speechToText = event.results[0][0].transcript;
            onReceiveText(speechToText);
          };
  
          recognition.onend = () => {
            setIsListening(false);
          };
  
          recognition.onerror = (event) => {
            console.error("Speech recognition error detected: ", event.error);
            setIsListening(false);
          };
  
          recognition.start();
      }
    };
  
    return (
      <div>
        <button type="button" className={styles.button} onClick={startListening}>
        <FontAwesomeIcon icon={isListening? faStopCircle: faMicrophone} size="lg"/>
        </button>
      </div>
    );
  };
  
  export default SpeechInput;