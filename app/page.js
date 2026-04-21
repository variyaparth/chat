import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const categories = ["All", "Fantasy", "Sci-Fi", "Romance", "Adventure", "Historical"];

function formatChatCount(value) {
  const count = Number(value) || 0;

  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1).replace(/\.0$/, "")}m chats`;
  }

  if (count >= 1000) {
    return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}k chats`;
  }

  return `${count} chats`;
}

export default async function HomePage() {
  const { data, error } = await supabase
    .from("characters")
    .select("id, name, description, system_prompt, avatar_emoji, banner_gradient, chat_count")
    .order("chat_count", { ascending: false });

  const characters = error ? [] : data || [];

  return (
    <div className="relative overflow-hidden">
      <section className="relative isolate px-4 pb-14 pt-16 sm:px-6 sm:pt-20 lg:px-8">
        <div className="hero-orb hero-orb-one" aria-hidden="true" />
        <div className="hero-orb hero-orb-two" aria-hidden="true" />
        <div className="hero-orb hero-orb-three" aria-hidden="true" />

        <div className="relative mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              <span className="bg-gradient-to-r from-[#8b5cf6] via-[#a78bfa] to-[#ec4899] bg-clip-text text-transparent">
                Meet Your AI Characters
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base text-gray-400 sm:text-lg">
              Choose a character and start an unforgettable conversation
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/chat"
                className="btn-interactive inline-flex w-full items-center justify-center rounded-full border border-[#8b5cf6] bg-[#8b5cf6] px-6 py-3 text-sm font-semibold text-white shadow-[0_0_35px_rgba(139,92,246,0.35)] hover:scale-[1.02] hover:bg-[#7c4df1] active:scale-[0.98] sm:w-auto"
              >
                Start Chatting
              </Link>
              <Link
                href="/create"
                className="btn-interactive inline-flex w-full items-center justify-center rounded-full border border-[#8b5cf6]/80 bg-transparent px-6 py-3 text-sm font-semibold text-[#d9ccff] hover:scale-[1.02] hover:border-[#a78bfa] hover:bg-white/5 hover:text-white active:scale-[0.98] sm:w-auto"
              >
                Create Character
              </Link>
            </div>
          </div>

          <div className="mx-auto mt-12 max-w-3xl">
            <label htmlFor="character-search" className="sr-only">
              Search characters
            </label>
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
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
                id="character-search"
                type="text"
                placeholder="Search characters..."
                className="w-full rounded-full border border-white/10 bg-[#10101a]/85 py-3 pl-12 pr-4 text-sm text-white outline-none placeholder:text-gray-500 transition focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#8b5cf6]/40"
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              {categories.map((category) => {
                const isActive = category === "All";

                return (
                  <button
                    key={category}
                    type="button"
                    className={`btn-interactive rounded-full border px-4 py-1.5 text-xs font-medium sm:text-sm ${
                      isActive
                        ? "border-[#8b5cf6] bg-[#8b5cf6]/20 text-[#d8c7ff]"
                        : "border-white/10 bg-white/5 text-gray-400 hover:border-[#8b5cf6]/60 hover:text-white active:scale-[0.98]"
                    }`}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          {error ? (
            <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              Could not load characters right now. Please try again in a moment.
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {characters.map((character, index) => {
              const bannerStyle = {
                background:
                  character.banner_gradient ||
                  "linear-gradient(135deg, rgba(139,92,246,0.95) 0%, rgba(59,130,246,0.9) 100%)",
              };

              return (
                <article
                  key={character.id}
                  className="card-fade-in group rounded-2xl border border-white/10 bg-[#11111a]/80 p-4 shadow-[0_10px_40px_rgba(0,0,0,0.35)] transition duration-300 hover:scale-[1.02] hover:border-[#8b5cf6]/70 hover:shadow-[0_0_35px_rgba(139,92,246,0.2)]"
                  style={{ animationDelay: `${Math.min(index, 8) * 90}ms` }}
                >
                  <div className="relative mb-10">
                    <div className="h-28 rounded-xl" style={bannerStyle} />
                    <div className="absolute -bottom-8 left-4 flex h-16 w-16 items-center justify-center rounded-full border-4 border-[#11111a] bg-[#1a1a2b] text-3xl shadow-lg">
                      <span aria-hidden="true">{character.avatar_emoji || "🤖"}</span>
                    </div>
                    <div className="absolute right-3 top-3 rounded-full border border-white/20 bg-black/30 px-2.5 py-1 text-xs font-medium text-gray-100 backdrop-blur">
                      {formatChatCount(character.chat_count)}
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-white">{character.name}</h3>
                  <p
                    className="mt-2 text-sm text-gray-400"
                    style={{
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {character.description || "No description yet."}
                  </p>

                  <Link
                    href={`/chat/${character.id}`}
                    className="btn-interactive mt-5 inline-flex items-center justify-center rounded-full border border-[#8b5cf6]/70 bg-[#8b5cf6]/15 px-4 py-2 text-sm font-semibold text-[#e2d7ff] hover:border-[#8b5cf6] hover:bg-[#8b5cf6]/25 hover:text-white active:scale-[0.98]"
                  >
                    Chat Now
                  </Link>
                </article>
              );
            })}
          </div>

          {!error && characters.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-gray-400">
              No characters found yet. Create the first one.
            </div>
          ) : null}
        </div>
      </section>

      <style jsx>{`
        .hero-orb {
          position: absolute;
          border-radius: 9999px;
          filter: blur(8px);
          opacity: 0.6;
          pointer-events: none;
        }

        .hero-orb-one {
          width: 260px;
          height: 260px;
          top: 40px;
          left: -80px;
          background: radial-gradient(circle, rgba(139, 92, 246, 0.55) 0%, rgba(139, 92, 246, 0) 70%);
          animation: driftA 10s ease-in-out infinite;
        }

        .hero-orb-two {
          width: 320px;
          height: 320px;
          top: 10px;
          right: -110px;
          background: radial-gradient(circle, rgba(59, 130, 246, 0.45) 0%, rgba(59, 130, 246, 0) 70%);
          animation: driftB 14s ease-in-out infinite;
        }

        .hero-orb-three {
          width: 220px;
          height: 220px;
          bottom: 0;
          left: 38%;
          background: radial-gradient(circle, rgba(236, 72, 153, 0.28) 0%, rgba(236, 72, 153, 0) 72%);
          animation: driftC 12s ease-in-out infinite;
        }

        @keyframes driftA {
          0%,
          100% {
            transform: translate3d(0, 0, 0);
          }
          50% {
            transform: translate3d(20px, -16px, 0);
          }
        }

        @keyframes driftB {
          0%,
          100% {
            transform: translate3d(0, 0, 0);
          }
          50% {
            transform: translate3d(-24px, 20px, 0);
          }
        }

        @keyframes driftC {
          0%,
          100% {
            transform: translate3d(0, 0, 0);
          }
          50% {
            transform: translate3d(12px, -14px, 0);
          }
        }
      `}</style>
    </div>
  );
}
