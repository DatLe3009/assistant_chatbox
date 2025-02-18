import os
import asyncio
import websockets
from RealtimeTTS import GTTSEngine, TextToAudioStream
import re

# Khởi tạo OpenAI TTS Engine
engine = GTTSEngine(
    voice="vi",
)

def run_async(coro):
    """Chạy một coroutine trong event loop chính"""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        asyncio.create_task(coro)  # Nếu event loop đang chạy, dùng create_task
    else:
        asyncio.run(coro)  # Nếu không có event loop, chạy coroutine ngay lập tức

async def handle_client(websocket, path=None):
    text_buffer = []
    BUFFER_THRESHOLD = 15  # Gom đủ 15 ký tự trước khi feed
    
    async def notify_client_start():
        print(f"AUDIO_START")
        await websocket.send("AUDIO_START")  # Dùng kết nối hiện tại để gửi

    async def notify_client_stop():
        print(f"AUDIO_STOP")
        await websocket.send("AUDIO_STOP")  # Dùng kết nối hiện tại để gửi

    # Gán callback cho stream
    stream = TextToAudioStream(
        engine=engine,
        language="vi",
        on_audio_stream_start=lambda: run_async(notify_client_start()),  # Gọi đúng cách
        on_audio_stream_stop=lambda: run_async(notify_client_stop())     # Gọi đúng cách
    )

    # 🚀 Mồi buffer bằng một khoảng trắng để tránh ngắt quãng đầu
    stream.feed([" "])  
    stream.play_async(
        buffer_threshold_seconds=0.2,  # Tăng buffer để tránh thiếu dữ liệu khi phát
        reset_generated_text=False,
        fast_sentence_fragment=True,
        fast_sentence_fragment_allsentences=True  # Bật cho toàn bộ câu để phát mượt hơn
    )

    async for text_chunk in websocket:
        if text_chunk:
            text_chunk = re.sub(r'[*#]', '', text_chunk)
            text_buffer.append(text_chunk)

            # Nếu câu có dấu kết thúc hoặc đủ dài, feed ngay lập tức
            full_text = "".join(text_buffer)
            if full_text and (len(full_text) >= BUFFER_THRESHOLD or full_text[-1] in ".?!\n"):
                if not stream.is_playing():
                    stream.play_async(  # Gọi play trước khi feed để chuẩn bị buffer
                        buffer_threshold_seconds=0.2,
                        reset_generated_text=False,
                        fast_sentence_fragment=True,
                        fast_sentence_fragment_allsentences=True
                    )

                stream.feed([full_text])  # Đẩy dữ liệu vào TTS
                text_buffer = []  # Reset buffer

                await asyncio.sleep(0.05)  # Chờ ngắn hơn để phản hồi nhanh hơn

async def main():
    """Khởi chạy WebSocket server"""
    start_server = await websockets.serve(handle_client, "localhost", 6789, ping_interval=None)
    print("✅ WebSocket server running on ws://localhost:6789")
    await start_server.wait_closed()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except RuntimeError:
        import nest_asyncio
        nest_asyncio.apply()
        asyncio.run(main())