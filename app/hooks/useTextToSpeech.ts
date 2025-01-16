import { useState } from 'react';
import md5 from 'md5';

export const useTextToSpeech = (
    listening, 
    handleStartListening, 
    handleStopListening, 
    resetTranscript,
    setProcessing
) => {
    const [currentAudio, setCurrentAudio] = useState(null); 

    const speakText = async (text: string, isKey: boolean = false) => {
        if (listening) handleStopListening();

        try {
            if (currentAudio) {
                currentAudio.pause(); // Dừng phát âm thanh
                currentAudio.currentTime = 0; // Đặt lại thời gian phát
            }

            let audioUrl: string;

            if (isKey) {
                // Tạo tên tệp bằng hash (md5)
                const fileName = `${md5(text)}.mp3`;
                const audioPath = `/audio/${fileName}`;
                
                // Kiểm tra nếu tệp đã tồn tại trong public/audio
                const responseCheck = await fetch(audioPath, { method: 'HEAD' });
                if (responseCheck.ok) {
                    // Tệp tồn tại, sử dụng đường dẫn cũ
                    audioUrl = audioPath;
                } else {
                    // Tệp không tồn tại, yêu cầu API để tạo
                    const response = await fetch('/api/tts', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ content: text }),
                    });
    
                    if (!response.ok) throw new Error('Failed to generate audio');
    
                    const audioBlob = await response.blob();
    
                    // Gửi audioBlob và fileName đến API /api/save-audio để lưu
                    const saveResponse = await fetch('/api/save-audio', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            fileName,
                            audioBlob: await audioBlob.arrayBuffer().then(buffer => Buffer.from(buffer).toString('base64')), // Chuyển blob sang base64
                        }),
                    });
    
                    if (!saveResponse.ok) throw new Error('Failed to save audio file');
    
                    audioUrl = audioPath;
                }
            } else {
                // Không phải isKey, gọi API TTS để phát âm thanh trực tiếp
                const response = await fetch('/api/tts', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ content: text }),
                });
    
                if (!response.ok) throw new Error('Failed to generate audio');
    
                const audioBlob = await response.blob();
                audioUrl = URL.createObjectURL(audioBlob);
            }

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