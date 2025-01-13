import { useCallback } from 'react';

export const useTextToSpeech = (
    isListening: boolean,
    setIsTalking: (state: boolean) => void,
    startListening: () => void,
    stopListening: () => void
) => {
    const speakText = useCallback(async (text: string) => {
        if (isListening) stopListening();

        try {
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
            audio.play().then(() => {
                console.log("Đang phát âm thanh...");
                setIsTalking(true); // Đang nói

                // Khi âm thanh kết thúc, khởi động lại ghi âm
                audio.onended = () => {
                    console.log("Kết thúc phát âm thanh, khởi động lại ghi âm...");
                    setIsTalking(false); // Ngừng nói
                    startListening(); // Bắt đầu ghi âm lại
                };
            }).catch(err => {
                console.error("Lỗi khi phát âm thanh:", err);
                // Khởi động lại ghi âm nếu có lỗi
                startListening();
            });
        } catch (error) {
            console.error('Error calling OpenAI API:', error);
        }
    }, [isListening, setIsTalking, startListening, stopListening]);

    return { speakText };
};