export async function buildSystemPromptWithMemory(baseSystemPrompt, userId, characterId, supabase) {
  const { data: memories } = await supabase
    .from("memories")
    .select("memory_text, importance")
    .eq("user_id", userId)
    .eq("character_id", characterId)
    .order("importance", { ascending: false })
    .limit(10);

  if (!memories || memories.length === 0) {
    return baseSystemPrompt;
  }

  const memoryBlock = memories.map((memory) => `- ${memory.memory_text}`).join("\n");

  return `${baseSystemPrompt}

=== YOUR MEMORY OF THIS USER ===
You remember these facts about the person you're talking to:
${memoryBlock}

Use this knowledge naturally in conversation. Reference past facts when relevant.
If they mention something new about themselves, acknowledge it warmly.
Never say "according to my memory" - just naturally remember like a real friend would.
=== END MEMORY ===`;
}
