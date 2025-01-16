import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { fileName, audioBlob } = body;

        if (!fileName || !audioBlob) {
            return NextResponse.json({ error: 'Invalid input: fileName and audioBlob are required' }, { status: 400 });
        }

        // Giải mã audioBlob (base64) thành Buffer
        const audioBuffer = Buffer.from(audioBlob, 'base64');

        // Đường dẫn lưu tệp
        const audioDir = path.join(process.cwd(), 'public', 'audio');
        const audioPath = path.join(audioDir, fileName);

        // Tạo thư mục nếu chưa tồn tại
        if (!fs.existsSync(audioDir)) {
            fs.mkdirSync(audioDir, { recursive: true });
        }

        // Lưu tệp (Buffer tương thích với Uint8Array)
        fs.writeFileSync(audioPath, new Uint8Array(audioBuffer));

        return NextResponse.json({ message: 'Audio file saved successfully', filePath: `/audio/${fileName}` }, { status: 200 });
    } catch (error) {
        console.error('Error saving audio file:', error);
        return NextResponse.json({ error: 'Failed to save audio file' }, { status: 500 });
    }
}
