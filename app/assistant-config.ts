export let assistantId = ""; // set your assistant ID here

if (assistantId === "") {
  assistantId = process.env.OPENAI_ASSISTANT_ID;
}

export const assistants = {
  subject: process.env.OPENAI_SUBJECT_ASSISTANT_ID, // ID của assistant nội dung môn học
  rules: process.env.OPENAI_RULES_ASSISTANT_ID,     // ID của assistant nội quy
  schedule: process.env.OPENAI_SCHEDULE_ASSISTANT_ID // ID của assistant thời khóa biểu
};

// Hàm lấy assistantId dựa trên chủ đề
export function getAssistantId(topic) {
  return assistants[topic] || "";
}
