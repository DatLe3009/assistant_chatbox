let ttsSocket, controlSocket;
let ttsMessageQueue = []; // Hàng đợi tin nhắn cho TTS Server
let controlMessageQueue = []; // Hàng đợi tin nhắn cho Control Server

// Kết nối tới TTS Server
export const connectTTSServer = (handleAudioStop) => {
    if (typeof window === "undefined") return; // Chỉ chạy trên client

    ttsSocket = new WebSocket("ws://127.0.0.1:6789");

    ttsSocket.onopen = () => {
        console.log("✅ Connected to TTS Server");
        // Gửi lại tin nhắn trong hàng đợi nếu có
        while (ttsMessageQueue.length > 0) {
            ttsSocket.send(ttsMessageQueue.shift());
        }
    };

    ttsSocket.onmessage = (event) => {
        // if (event.data === "AUDIO_START") {
        //     onStatusUpdate(true);  // Đang phát
        // } else 
        console.log("📩 Message received from server:", event.data);
        if (event.data === "AUDIO_STOP") {
            handleAudioStop(); // Dừng phát
        }
    };

    ttsSocket.onclose = () => {
        console.log("⚠️ Disconnected from TTS Server. Reconnecting in 3s...");
        setTimeout(connectTTSServer, 3000);
    };

    ttsSocket.onerror = (error) => {
        console.error("❌ TTS WebSocket Error:", error);
    };
};

// Kết nối tới Raspberry Pi
export const connectControlServer = () => {
    if (typeof window === "undefined") return; // Chỉ chạy trên client

    controlSocket = new WebSocket("ws://raspberrypi.local:8765");

    controlSocket.onopen = () => {
        console.log("✅ Connected to Raspberry Pi");
        // Gửi lại tin nhắn trong hàng đợi nếu có
        while (controlMessageQueue.length > 0) {
            controlSocket.send(controlMessageQueue.shift());
        }
        controlSocket.send("on"); // Bật đèn
        setTimeout(() => controlSocket.send("off"), 3000); // Tắt sau 3 giây
    };

    controlSocket.onmessage = (event) => {
        console.log(`📩 Raspberry Pi says: ${event.data}`);
    };

    controlSocket.onclose = () => {
        console.log("⚠️ Disconnected from Raspberry Pi. Reconnecting in 3s...");
        setTimeout(connectControlServer, 3000);
    };

    controlSocket.onerror = (error) => {
        console.error("❌ Control WebSocket Error:", error);
    };
};

// Gửi dữ liệu đến TTS Server
export const sendChunkToTTSServer = (chunk) => {
    if (ttsSocket && ttsSocket.readyState === WebSocket.OPEN) {
        ttsSocket.send(chunk);
        console.log(`📤 Sent to TTS Server: ${chunk}`);
    } else {
        console.warn("⚠️ TTS Server is not open. Message added to queue.");
        ttsMessageQueue.push(chunk);
    }
};

// Gửi dữ liệu đến Raspberry Pi
export const sendChunkToControlServer = (message) => {
    if (controlSocket && controlSocket.readyState === WebSocket.OPEN) {
        controlSocket.send(message);
        console.log(`📤 Sent to Raspberry Pi: ${message}`);
    } else {
        console.warn("⚠️ Control Server is not open. Message added to queue.");
        controlMessageQueue.push(message);
    }
};
