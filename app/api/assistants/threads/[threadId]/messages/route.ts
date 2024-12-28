import { getAssistantId } from "@/app/assistant-config";
import { openai } from "@/app/openai";

export const runtime = "nodejs";

// Send a new message to a thread
export async function POST(request, { params: { threadId } }) {
  const { content, topic } = await request.json();
  let assistantId = getAssistantId(topic);
  if (!assistantId) {
    throw new Error("Không tìm thấy Assistant ID cho chủ đề này.");
  }

  await openai.beta.threads.messages.create(threadId, {
    role: "user",
    content: content,
  });

  const stream = openai.beta.threads.runs.stream(threadId, {
    assistant_id: assistantId,
  });

  return new Response(stream.toReadableStream());
}
