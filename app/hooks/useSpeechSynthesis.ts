export const useSpeechSynthesis = (
    isListening: boolean,
    setIsTalking: (state: boolean) => void, // Cập nhật trạng thái nói
    startListening: () => void, // Tự động khởi động lại ghi âm
    stopListening: () => void
) => {
    const speakText = (text: string) => {
        if (isListening) stopListening();

        setTimeout(() => {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = "vi-VN";

            utterance.onstart = () => {
                console.log("Bắt đầu nói...");
                setIsTalking(true); // Đang nói
            };

            utterance.onend = () => {
                console.log("Kết thúc nói, khởi động lại ghi âm...");
                setIsTalking(false); // Ngừng nói
                startListening(); // Bắt đầu ghi âm lại
            };

            window.speechSynthesis.speak(utterance);
        }, 200);
    };

    return { speakText };
};