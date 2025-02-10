let ws;

export const connectWebSocket = () => {
    ws = new WebSocket("ws://raspberrypi.local:8765");

    ws.onopen = () => {
        console.log("Connected to Raspberry Pi");
        ws.send("on"); // Bat dèn
        setTimeout(() => ws.send("off"), 3000); // Tat sau 3 giây
    };

    ws.onmessage = (event) => {
        console.log(`Raspberry Pi says: ${event.data}`);
    };

    ws.onclose = () => {
        console.log("Disconnected. Reconnecting in 3 seconds...");
        setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = (error) => {
        console.error("WebSocket Error:", error);
    };
};

export const sendMessageWebSocket = (message) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(message);
    } else {
        console.error("WebSocket is not connected.");
    }
};
