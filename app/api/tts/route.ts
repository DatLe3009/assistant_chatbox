import { openai } from "@/app/openai";

export const runtime = "nodejs";

// Send a new text to tts
export async function POST(request) {
    const { content } = await request.json();

    const response = await openai.audio.speech.create({
        model: 'tts-1', // Hoặc 'tts-1-hd'
        input: content,
        voice: 'alloy', // Chọn giọng nói
        response_format: 'mp3', // Tùy chọn
        speed: 1.0 // Tùy chọn
    });

    const audioBuffer = await response.arrayBuffer();

    // Trả về trực tiếp file âm thanh dạng Buffer
    return new Response(audioBuffer, {
        headers: {
            "Content-Type": "audio/mpeg",
        },
    });
}

// option2
export async function GET(request) {
    const url = new URL(request.url);
    const content = url.searchParams.get("content");

    const response = await openai.audio.speech.create({
        model: 'tts-1', // Hoặc 'tts-1-hd'
        input: content,
        voice: 'alloy', // Chọn giọng nói
        response_format: 'mp3', // Tùy chọn
        speed: 1.0 // Tùy chọn
    });

    const readableStream = response.body; // Đọc trực tiếp luồng dữ liệu từ OpenAI API.

    return new Response(readableStream, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Transfer-Encoding": "chunked", // Đảm bảo trả về dạng stream
      },
    });
}