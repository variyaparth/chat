"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const categoryMeta = {
  personal: { icon: "👤", label: "Personal" },
  preference: { icon: "💜", label: "Preferences" },
  event: { icon: "📅", label: "Events" },
  emotion: { icon: "😊", label: "Emotions" },
  goal: { icon: "🎯", label: "Goals" },
  general: { icon: "🧠", label: "General" },
};

function renderStars(importance) {
  const count = Math.max(1, Math.min(5, Number(importance) || 1));
  return "⭐".repeat(count);
}

export default function MemoryViewerPage({ params }) {
  const characterId = params?.characterId;

  const [user, setUser] = useState(null);
  const [character, setCharacter] = useState(null);
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadPage() {
      setLoading(true);
      setError("");

      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (ignore) {
        return;
      }

      if (!currentUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      setUser(currentUser);

      const { data: characterRow, error: characterError } = await supabase
        .from("characters")
        .select("id, name, avatar_emoji")
        .eq("id", characterId)
        .single();

      if (ignore) {
        return;
      }

      if (characterError || !characterRow) {
        setError("Character not found.");
        setLoading(false);
        return;
      }

      setCharacter(characterRow);

      const { data: memoryRows, error: memoryError } = await supabase
        .from("memories")
        .select("id, memory_text, category, importance, created_at")
        .eq("user_id", currentUser.id)
        .eq("character_id", characterId)
        .order("importance", { ascending: false })
        .order("created_at", { ascending: false });

      if (ignore) {
        return;
      }

      if (memoryError) {
        setError("Could not load memories.");
      } else {
        setMemories(memoryRows || []);
      }

      setLoading(false);
    }

    if (characterId) {
      loadPage();
    }

    return () => {
      ignore = true;
    };
  }, [characterId]);

  const groupedMemories = useMemo(() => {
    const groups = {};

    for (const memory of memories) {
      const category = memory.category || "general";

      if (!groups[category]) {
        groups[category] = [];
      }

      groups[category].push(memory);
    }

    return groups;
  }, [memories]);

  async function handleDeleteMemory(memoryId) {
    const { error: deleteError } = await supabase.from("memories").delete().eq("id", memoryId);

    if (deleteError) {
      setError("Could not delete memory.");
      return;
    }

    setMemories((prev) => prev.filter((memory) => memory.id !== memoryId));
  }

  async function handleClearAll() {
    if (!user) {
      return;
    }

    const { error: clearError } = await supabase
      .from("memories")
      .delete()
      .eq("user_id", user.id)
      .eq("character_id", characterId);

    if (clearError) {
      setError("Could not clear memories.");
      return;
    }

    setMemories([]);
    setConfirmClear(false);
  }

  return (
    <div className="min-h-[calc(100dvh-73px)] bg-[#0a0a0f] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        {!user && !loading ? (
          <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Please login to view memories.
          </div>
        ) : null}

        {character ? (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-white/10 bg-[#12121d] p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#23233a] text-2xl">
              {character.avatar_emoji || "🤖"}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white sm:text-3xl">
                What {character.name} remembers about you
              </h1>
              <p className="mt-1 text-sm text-gray-400">Your shared memory profile</p>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        {loading ? <div className="text-sm text-gray-400">Loading memories...</div> : null}

        {!loading && memories.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#12121d]/80 px-6 py-16 text-center">
            <p className="text-6xl">🧠</p>
            <p className="mt-4 text-xl font-semibold text-white">No memories yet - start chatting!</p>
            <Link
              href={`/chat/${characterId}`}
              className="btn-interactive mt-6 inline-flex rounded-xl border border-[#8b5cf6] bg-[#8b5cf6] px-4 py-2 text-sm font-semibold text-white hover:bg-[#7c4df1]"
            >
              Start Chat
            </Link>
          </div>
        ) : null}

        {!loading && memories.length > 0 ? (
          <div className="space-y-6">
            {Object.entries(groupedMemories).map(([category, rows]) => {
              const meta = categoryMeta[category] || categoryMeta.general;

              return (
                <section key={category} className="rounded-2xl border border-white/10 bg-[#12121d] p-4">
                  <h2 className="mb-3 text-lg font-semibold text-white">
                    {meta.icon} {meta.label}
                  </h2>

                  <div className="space-y-2">
                    {rows.map((memory) => (
                      <article
                        key={memory.id}
                        className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-[#171725] p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-white">{memory.memory_text}</p>
                          <p className="mt-1 text-xs text-gray-400">
                            {renderStars(memory.importance)} • {new Date(memory.created_at).toLocaleDateString()}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteMemory(memory.id)}
                          className="btn-interactive inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 text-xs text-gray-300 hover:bg-red-500/10 hover:text-red-300"
                          aria-label="Delete memory"
                        >
                          X
                        </button>
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}

            <div className="flex justify-end">
              {!confirmClear ? (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="btn-interactive rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-500/20"
                >
                  Clear All Memories
                </button>
              ) : (
                <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  <span>Clear all memories?</span>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="btn-interactive rounded-md bg-red-500/20 px-2 py-1 hover:bg-red-500/30"
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="btn-interactive rounded-md bg-white/10 px-2 py-1 text-gray-200 hover:bg-white/15"
                  >
                    No
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
