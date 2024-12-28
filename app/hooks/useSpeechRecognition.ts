import { useRef, useEffect } from "react";

declare global {
    interface Window {
      SpeechRecognition: any;
      webkitSpeechRecognition: any;
    }
}
export const useSpeechRecognition = (onCommand, setIsListening, isListening, setIsTalking, isTalking) => {
    const recognition = useRef(null);

    useEffect(() => {
        if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
            console.error("Trình duyệt không hỗ trợ Speech Recognition");
            return;
        }

        recognition.current = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        recognition.current.lang = "vi-VN"; // Thiết lập tiếng Việt
        recognition.current.continuous = true; // Liên tục lắng nghe
        recognition.current.interimResults = false; // Chỉ nhận kết quả cuối cùng

        // Callback khi có kết quả nhận diện
        recognition.current.onresult = (event) => {
            console.log("Kết quả nhận diện:", event.results);
            const transcript = event.results[event.results.length - 1][0].transcript.trim();
            console.log("Transcript:", transcript);
            onCommand(transcript); // Gửi dữ liệu về callback
        };

        recognition.current.onerror = (event) => {
            console.warn("Lỗi nhận diện giọng nói:", event.error);
        };

        recognition.current.onstart = () => {
            setIsListening(true);
        }

        recognition.current.onend = () => {
            console.log("Speech recognition đã kết thúc");
            setIsListening(false); // Cập nhật trạng thái nếu không cần lắng nghe
            
        };
    
        return () => recognition.current?.stop(); // Dừng nhận diện khi component unmount
    }, [onCommand, setIsListening]);

    // Hàm điều khiển
    const startListening = () => {
        if (recognition.current && !isTalking) {
            try {
                console.log("Bắt đầu lắng nghe...");
                recognition.current.start();
            } catch (error) {
                console.warn("Lỗi khi khởi động lại nhận diện:", error);
                recognition.current.stop();
                setTimeout(() => recognition.current.start(), 500); // Khởi động lại sau 500ms
            }
        }
    };

    const stopListening = () => {
        if (recognition.current && isListening) {
            console.log("Dừng lắng nghe");
            recognition.current.stop();

            recognition.current.onend = () => {
                setIsListening(false); // Đồng bộ trạng thái
                console.log("Đã dừng lắng nghe hoàn toàn.");
            };
        }
    };

    return { startListening, stopListening };
};
