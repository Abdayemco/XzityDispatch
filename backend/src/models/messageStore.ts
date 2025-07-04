const messageStore: Record<string, any[]> = {};

export function saveMessage(chatId: string | number, msg: any) {
  const key = String(chatId);
  if (!messageStore[key]) messageStore[key] = [];
  messageStore[key].push(msg);
}

export function getMessages(chatId: string | number) {
  return messageStore[String(chatId)] || [];
}