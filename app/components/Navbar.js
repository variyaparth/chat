"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import { supabase } from "@/lib/supabase";

const HISTORY_SEEN_KEY = "history_last_seen_at";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [hasNewConversations, setHasNewConversations] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const initialLetter = useMemo(() => {
    if (!user) {
      return "U";
    }

    const username = user.user_metadata?.username;
    const source = username || user.email || "U";

    return source.charAt(0).toUpperCase();
  }, [user]);

  useEffect(() => {
    let mounted = true;

    async function loadUserAndNotifications() {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (!mounted) {
        return;
      }

      setUser(currentUser || null);

      if (!currentUser) {
        setHasNewConversations(false);
        return;
      }

      const { data } = await supabase
        .from("conversations")
        .select("id, last_message_at")
        .eq("user_id", currentUser.id)
        .order("last_message_at", { ascending: false })
        .limit(1);

      const latestConversationAt = data?.[0]?.last_message_at;

      if (!latestConversationAt) {
        setHasNewConversations(false);
        return;
      }

      const lastSeen = localStorage.getItem(HISTORY_SEEN_KEY);
      const seenTime = lastSeen ? new Date(lastSeen).getTime() : 0;
      const latestTime = new Date(latestConversationAt).getTime();

      setHasNewConversations(latestTime > seenTime);
    }

    loadUserAndNotifications();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      setMenuOpen(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (pathname === "/history") {
      localStorage.setItem(HISTORY_SEEN_KEY, new Date().toISOString());
      setHasNewConversations(false);
    }
  }, [pathname]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setMenuOpen(false);
    router.push("/auth");
  }

  function markHistorySeen() {
    localStorage.setItem(HISTORY_SEEN_KEY, new Date().toISOString());
    setHasNewConversations(false);
    setMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0a0f]/70 backdrop-blur-xl">
      <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="btn-interactive flex items-center gap-2 text-base font-semibold sm:text-lg"
          aria-label="CharacterChat home"
        >
          <span className="text-xl" aria-hidden="true">
            ✨
          </span>
          <span className="gradient-logo">CharacterChat</span>
        </Link>

        <div className="hidden items-center gap-6 text-sm font-medium text-gray-400 md:flex">
          <Link href="/explore" className="btn-interactive transition hover:text-white active:text-white">
            Explore
          </Link>
          <Link href="/create" className="btn-interactive transition hover:text-white active:text-white">
            Create
          </Link>
          <Link
            href="/history"
            onClick={markHistorySeen}
            className="btn-interactive relative inline-flex items-center gap-1.5 transition hover:text-white active:text-white"
          >
            <Clock className="h-4 w-4" />
            History
            {hasNewConversations ? (
              <span className="absolute -right-2 -top-1 h-2.5 w-2.5 rounded-full bg-[#8b5cf6]" />
            ) : null}
          </Link>
        </div>

        {!user ? (
          <Link
            href="/auth"
            className="btn-interactive rounded-full border border-[#8b5cf6] px-4 py-2 text-sm font-medium text-[#d8c7ff] hover:bg-[#8b5cf6]/15 hover:text-white active:scale-[0.98]"
          >
            Sign In
          </Link>
        ) : (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              className="btn-interactive inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#8b5cf6] text-sm font-semibold text-white hover:bg-[#7c4df1]"
              aria-label="Open user menu"
            >
              {initialLetter}
            </button>

            {menuOpen ? (
              <div className="absolute right-0 z-30 mt-2 w-52 rounded-xl border border-white/10 bg-[#141422] p-1.5 shadow-xl">
                <Link
                  href="/profile"
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm text-gray-300 transition hover:bg-white/10 hover:text-white"
                >
                  My Profile
                </Link>
                <Link
                  href="/history"
                  onClick={markHistorySeen}
                  className="block rounded-lg px-3 py-2 text-sm text-gray-300 transition hover:bg-white/10 hover:text-white"
                >
                  My Conversations
                </Link>
                <div className="my-1 border-t border-white/10" />
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-300 transition hover:bg-red-500/10"
                >
                  Sign Out
                </button>
              </div>
            ) : null}
          </div>
        )}
      </nav>

      <div className="border-t border-white/10 px-4 py-2 md:hidden">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-center gap-5 text-sm font-medium text-gray-400">
          <Link href="/explore" className="btn-interactive transition hover:text-white active:text-white">
            Explore
          </Link>
          <Link href="/create" className="btn-interactive transition hover:text-white active:text-white">
            Create
          </Link>
          <Link
            href="/history"
            onClick={markHistorySeen}
            className="btn-interactive relative inline-flex items-center gap-1 transition hover:text-white active:text-white"
          >
            <Clock className="h-4 w-4" />
            History
            {hasNewConversations ? (
              <span className="absolute -right-2 -top-1 h-2.5 w-2.5 rounded-full bg-[#8b5cf6]" />
            ) : null}
          </Link>
        </div>
      </div>
    </header>
  );
}
