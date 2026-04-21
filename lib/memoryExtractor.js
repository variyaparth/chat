export async function extractMemories(messages, existingMemories) {
  const conversationText = messages
    .map((message) => `${message.role === "user" ? "User" : "AI"}: ${message.content || ""}`)
    .join("\n");

  const response = await fetch("/api/extract-memories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationText, existingMemories }),
  });

  if (!response.ok) {
    throw new Error("Failed to extract memories");
  }

  const payload = await response.json();
  return Array.isArray(payload?.memories) ? payload.memories : [];
}
