import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const extractorPrompt = `You are a memory extraction system. Analyze the conversation and extract important facts about the USER ONLY.
Return ONLY a JSON array of memory objects. No other text.
Each memory: { memory_text: string, category: string, importance: number }
Categories: personal (name, age, job), preference (likes, dislikes), event (things that happened), emotion (feelings expressed), goal (what they want)
Importance 1-5 where 5 = very important (like their name).
Only extract clear facts, not guesses. Max 5 memories per extraction.
Example output:
[
  { "memory_text": "User's name is Alex", "category": "personal", "importance": 5 },
  { "memory_text": "User loves fantasy novels", "category": "preference", "importance": 3 },
  { "memory_text": "User mentioned they have a dog named Max", "category": "personal", "importance": 3 }
]`;

function parseMemories(rawText) {
  try {
    const parsed = JSON.parse(rawText);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    const match = rawText.match(/\[[\s\S]*\]/);

    if (!match) {
      return [];
    }

    try {
      const parsed = JSON.parse(match[0]);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}

export async function POST(request) {
  try {
    const { conversationText, existingMemories = [] } = await request.json();

    if (typeof conversationText !== "string" || conversationText.trim().length < 20) {
      return Response.json({ memories: [] }, { status: 400 });
    }

    if (!Array.isArray(existingMemories)) {
      return Response.json({ memories: [] }, { status: 400 });
    }

    const prompt = `Extract memories from this conversation:\n${conversationText}\n\nAlready known facts (don't repeat):\n${existingMemories
      .map((memory) => memory.memory_text)
      .join("\n")}`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 700,
      system: extractorPrompt,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content?.[0]?.text || "[]";
    const memories = parseMemories(text)
      .map((memory) => ({
        memory_text: String(memory.memory_text || "").trim(),
        category: String(memory.category || "general").toLowerCase(),
        importance: Math.max(1, Math.min(5, Number(memory.importance) || 1)),
      }))
      .filter((memory) => memory.memory_text.length > 0)
      .slice(0, 5);

    return Response.json({ memories });
  } catch (error) {
    console.error("/api/extract-memories error:", error);
    return Response.json({ memories: [] }, { status: 500 });
  }
}
