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