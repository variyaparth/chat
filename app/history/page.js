"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/lib/supabase";

const sortOptions = ["Recent", "Oldest", "Most Messages"];

function truncateText(value, maxLength = 60) {
  if (!value) {
    return "No messages yet";
  }

  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}…`;
}

function getSortValue(option) {
  if (option === "Oldest") {
    return "oldest";
  }

  if (option === "Most Messages") {
    return "most_messages";
  }

  return "recent";
}

function sortConversations(list, sortBy) {
  const cloned = [...list];

  if (sortBy === "oldest") {
    return cloned.sort((a, b) => {
      const aTime = new Date(a.last_message_at || a.created_at || 0).getTime();
      const bTime = new Date(b.last_message_at || b.created_at || 0).getTime();
      return aTime - bTime;
    });
  }

  if (sortBy === "most_messages") {
    return cloned.sort((a, b) => (b.message_count || 0) - (a.message_count || 0));
  }

  return cloned.sort((a, b) => {
    const aTime = new Date(a.last_message_at || a.created_at || 0).getTime();
    const bTime = new Date(b.last_message_at || b.created_at || 0).getTime();
    return bTime - aTime;
  });
}

export default function HistoryPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [conversations, setConversations] = useState([]);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [removingIds, setRemovingIds] = useState([]);

  async function fetchConversations(currentUserId) {
    const { data, error: fetchError } = await supabase
      .from("conversations")
      .select(
        "id, user_id, character_id, title, last_message, last_message_at, message_count, created_at, characters(name, avatar_emoji, banner_gradient, category)"
      )
      .eq("user_id", currentUserId)
      .order("last_message_at", { ascending: false });

    if (fetchError) {
      throw fetchError;
    }

    const mapped = (data || []).map((item) => ({
      ...item,
      character_name: item.characters?.name || "Unknown Character",
      avatar_emoji: item.characters?.avatar_emoji || "🤖",
      banner_gradient:
        item.characters?.banner_gradient ||
        "linear-gradient(135deg, rgba(139,92,246,0.9) 0%, rgba(59,130,246,0.9) 100%)",
      category: item.characters?.category || "General",
    }));

    setConversations(mapped);
  }

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      setLoading(true);
      setError("");

      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (!mounted) {
        return;
      }

      setUser(currentUser || null);

      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        await fetchConversations(currentUser.id);
      } catch {
        if (mounted) {
          setError("Could not load conversation history.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    const channel = supabase
      .channel("conversations")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
          filter: `user_id=eq.${user.id}`,
        },
        async () => {
          try {
            await fetchConversations(user.id);
          } catch {
            setError("Could not refresh conversations in real time.");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const filteredConversations = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const sorted = sortConversations(conversations, sortBy);

    if (!needle) {
      return sorted;
    }

    return sorted.filter((conversation) => {
      const inName = conversation.character_name.toLowerCase().includes(needle);
      const inMessage = (conversation.last_message || "").toLowerCase().includes(needle);
      return inName || inMessage;
    });
  }, [conversations, search, sortBy]);

  async function handleDeleteConversation(conversationId) {
    setOpenMenuId(null);

    const { error: deleteError } = await supabase
      .from("conversations")
      .delete()
      .eq("id", conversationId)
      .eq("user_id", user.id);

    if (deleteError) {
      setError("Could not delete conversation.");
      setConfirmDeleteId(null);
      return;
    }

    setRemovingIds((prev) => [...prev, conversationId]);

    setTimeout(() => {
      setConversations((prev) => prev.filter((item) => item.id !== conversationId));
      setRemovingIds((prev) => prev.filter((id) => id !== conversationId));
      setConfirmDeleteId(null);
    }, 240);
  }

  return (
    <div className="min-h-[calc(100dvh-73px)] bg-[#0a0a0f] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <h1 className="text-3xl font-extrabold text-white sm:text-4xl">Your Conversations</h1>
          <p className="mt-2 text-sm text-gray-400 sm:text-base">Pick up where you left off</p>
        </div>

        {!user && !loading ? (
          <div className="mb-6 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Login to view your conversation history.
          </div>
        ) : null}

        {error ? (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xl">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20L16.65 16.65" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by character or message..."
              className="w-full rounded-full border border-white/10 bg-[#161622] py-2.5 pl-10 pr-4 text-sm text-white outline-none transition focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#8b5cf6]/35"
            />
          </div>

          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
            {sortOptions.map((option) => {
              const value = getSortValue(option);
              const active = sortBy === value;

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setSortBy(value)}
                  className={`btn-interactive rounded-full border px-3 py-1.5 text-xs font-medium sm:text-sm ${
                    active
                      ? "border-[#8b5cf6] bg-[#8b5cf6]/20 text-[#e2d7ff]"
                      : "border-white/10 bg-white/5 text-gray-400 hover:border-[#8b5cf6]/60 hover:text-white"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="animate-pulse rounded-2xl border border-white/10 bg-[#12121d] p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-white/10" />
                  <div className="min-w-0 flex-1">
                    <div className="h-4 w-40 rounded bg-white/10" />
                    <div className="mt-2 h-3 w-4/5 rounded bg-white/10" />
                    <div className="mt-2 h-5 w-20 rounded-full bg-white/10" />
                  </div>
                  <div className="flex w-24 flex-col items-end gap-2">
                    <div className="h-3 w-16 rounded bg-white/10" />
                    <div className="h-5 w-14 rounded-full bg-white/10" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {!loading && filteredConversations.length > 0 ? (
          <div className="space-y-3">
            {filteredConversations.map((conversation) => {
              const isMenuOpen = openMenuId === conversation.id;
              const isConfirmingDelete = confirmDeleteId === conversation.id;
              const isRemoving = removingIds.includes(conversation.id);
              const timeAgo = conversation.last_message_at
                ? formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: true })
                : formatDistanceToNow(new Date(conversation.created_at), { addSuffix: true });

              return (
                <article
                  key={conversation.id}
                  className={`group relative rounded-2xl border border-white/10 bg-[#12121d] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#8b5cf6]/55 hover:bg-[#171728] ${
                    isRemoving ? "opacity-0" : "opacity-100"
                  }`}
                >
                  <span className="pointer-events-none absolute inset-y-0 left-0 w-1 rounded-l-2xl bg-[#8b5cf6] opacity-0 transition group-hover:opacity-100" />

                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-2xl shadow-lg"
                      style={{ background: conversation.banner_gradient }}
                    >
                      {conversation.avatar_emoji}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white sm:text-base">
                        {conversation.character_name}
                      </p>
                      <p className="mt-1 truncate text-sm text-gray-400">
                        {truncateText(conversation.last_message, 60)}
                      </p>
                      <span className="mt-2 inline-flex rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-gray-400">
                        {conversation.category}
                      </span>
                    </div>

                    <div className="ml-2 flex shrink-0 flex-col items-end gap-2">
                      <p className="text-xs text-gray-400">{timeAgo}</p>
                      <span className="rounded-full border border-[#8b5cf6]/40 bg-[#8b5cf6]/20 px-2.5 py-1 text-[11px] font-medium text-[#dfd2ff]">
                        {conversation.message_count || 0} msgs
                      </span>

                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId((prev) => (prev === conversation.id ? null : conversation.id));
                            setConfirmDeleteId(null);
                          }}
                          className="btn-interactive inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm text-gray-300 hover:text-white"
                          aria-label="Conversation options"
                        >
                          ⋯
                        </button>

                        {isMenuOpen ? (
                          <div className="absolute right-0 z-10 mt-2 w-40 rounded-xl border border-white/10 bg-[#151525] p-1 shadow-xl">
                            <Link
                              href={`/chat/${conversation.character_id}`}
                              className="block rounded-lg px-3 py-2 text-sm text-gray-300 transition hover:bg-white/10 hover:text-white"
                            >
                              Continue Chat
                            </Link>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(conversation.id)}
                              className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-300 transition hover:bg-red-500/10"
                            >
                              Delete Conversation
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {isConfirmingDelete ? (
                    <div className="mt-3 flex items-center gap-3 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                      <span>Delete this conversation?</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteConversation(conversation.id)}
                        className="btn-interactive rounded-md bg-red-500/20 px-2 py-1 font-medium text-red-200 hover:bg-red-500/30"
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="btn-interactive rounded-md bg-white/10 px-2 py-1 text-gray-200 hover:bg-white/15"
                      >
                        No
                      </button>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : null}

        {!loading && filteredConversations.length === 0 ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#12121d]/70 px-6 text-center">
            <p className="text-6xl">💬</p>
            <h2 className="mt-5 text-2xl font-bold text-white">No conversations yet</h2>
            <p className="mt-2 max-w-md text-sm text-gray-400 sm:text-base">
              Start chatting with a character to see your history here
            </p>
            <Link
              href="/"
              className="btn-interactive mt-6 inline-flex rounded-xl border border-[#8b5cf6] bg-[#8b5cf6] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#7c4df1]"
            >
              Browse Characters
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
