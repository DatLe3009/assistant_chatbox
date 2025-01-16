import { useState } from 'react';

export const useTextToSpeech = (
    listening, 
    handleStartListening, 
    handleStopListening, 
    resetTranscript,
    setProcessing
) => {
    const [currentAudio, setCurrentAudio] = useState(null); 

    const speakText = async (text: string) => {
        if (listening) handleStopListening();

        try {
            if (currentAudio) {
                currentAudio.pause(); // Dừng phát âm thanh
                currentAudio.currentTime = 0; // Đặt lại thời gian phát
            }

            const response = await fetch('/api/tts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content: text }), // Gửi nội dung văn bản
            });

            if (!response.ok) throw new Error("Failed to generate audio");

            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);

            const audio = new Audio(audioUrl);
            setCurrentAudio(audio); // Lưu âm thanh hiện tại vào state
            audio.play().then(() => {
                console.log("Đang phát âm thanh...");

                audio.onended = () => {
                    resetTranscript();
                    new Promise(resolve => setTimeout(resolve, 100)); // 100ms
                    handleStartListening();
                    setProcessing(false);

                    console.log("Kết thúc phát âm thanh, khởi động lại ghi âm...");
                    setCurrentAudio(null); // Xóa âm thanh hiện tại khi kết thúc
                };
            }).catch(err => {
                console.error("Lỗi khi phát âm thanh:", err);
            });
        } catch (error) {
            console.error('Error calling OpenAI API:', error);
        }
    };

    return { speakText };
};