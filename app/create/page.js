"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const speakingStyles = ["Casual", "Formal", "Poetic", "Blunt", "Mysterious"];
const categories = ["Fantasy", "Sci-Fi", "Romance", "Adventure", "Historical"];

const emojiOptions = [
  "🤖",
  "🧙",
  "👩‍🚀",
  "🧛",
  "🧝",
  "🐉",
  "🦊",
  "👑",
  "🕵️",
  "⚔️",
  "🎻",
  "🧠",
  "🌙",
  "🔥",
  "💫",
  "🧪",
  "📚",
  "🦾",
  "🎭",
  "✨",
];

const gradientOptions = [
  "linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)",
  "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
  "linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)",
  "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)",
  "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
  "linear-gradient(135deg, #f43f5e 0%, #8b5cf6 100%)",
];

export default function CreateCharacterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [personality, setPersonality] = useState("");
  const [backstory, setBackstory] = useState("");
  const [speakingStyle, setSpeakingStyle] = useState(speakingStyles[0]);
  const [category, setCategory] = useState(categories[0]);
  const [avatarEmoji, setAvatarEmoji] = useState("🤖");
  const [bannerGradient, setBannerGradient] = useState(gradientOptions[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const systemPrompt = useMemo(() => {
    return `You are ${name || "a character"}. ${backstory || "No backstory provided."}. Your personality is ${
      personality || "adaptable"
    }. You speak in a ${speakingStyle.toLowerCase()} tone. Always stay in character.`;
  }, [name, backstory, personality, speakingStyle]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!name.trim() || !description.trim() || !personality.trim() || !backstory.trim()) {
      setError("Please fill in all required fields.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    const fullPayload = {
      name: name.trim(),
      description: description.trim(),
      personality: personality.trim(),
      backstory: backstory.trim(),
      speaking_style: speakingStyle,
      category,
      avatar_emoji: avatarEmoji,
      banner_gradient: bannerGradient,
      system_prompt: systemPrompt,
      chat_count: 0,
    };

    const fallbackPayload = {
      name: name.trim(),
      description: description.trim(),
      avatar_emoji: avatarEmoji,
      banner_gradient: bannerGradient,
      system_prompt: systemPrompt,
      chat_count: 0,
    };

    try {
      let insertResult = await supabase.from("characters").insert(fullPayload).select("id").single();

      if (insertResult.error) {
        const maybeSchemaMismatch = /column|schema|does not exist|unknown/i.test(insertResult.error.message || "");

        if (maybeSchemaMismatch) {
          insertResult = await supabase.from("characters").insert(fallbackPayload).select("id").single();
        }
      }

      if (insertResult.error || !insertResult.data?.id) {
        throw new Error(insertResult.error?.message || "Failed to create character");
      }

      router.push(`/chat/${insertResult.data.id}`);
    } catch (submitError) {
      setError(submitError.message || "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="bg-gradient-to-r from-[#8b5cf6] via-[#a78bfa] to-[#ec4899] bg-clip-text text-3xl font-extrabold text-transparent sm:text-4xl">
            Create a Character
          </h1>
          <p className="mt-3 text-sm text-gray-400 sm:text-base">
            Design a memorable personality and launch a new AI companion in seconds.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-[#8b5cf6]/40 bg-[#11111a]/90 p-5 shadow-[0_0_45px_rgba(139,92,246,0.2)] sm:p-6"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-gray-400">
                  Character Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#191927] px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#8b5cf6]/40"
                  placeholder="Captain Nyra"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-gray-400">
                  Description
                </label>
                <textarea
                  id="description"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full resize-none rounded-xl border border-white/10 bg-[#191927] px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#8b5cf6]/40"
                  placeholder="A fearless pilot who helps lost travelers cross dangerous galaxies."
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="personality" className="mb-1.5 block text-sm font-medium text-gray-400">
                  Personality
                </label>
                <textarea
                  id="personality"
                  rows={3}
                  value={personality}
                  onChange={(e) => setPersonality(e.target.value)}
                  className="w-full resize-none rounded-xl border border-white/10 bg-[#191927] px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#8b5cf6]/40"
                  placeholder="Witty, sarcastic, loves science fiction..."
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="backstory" className="mb-1.5 block text-sm font-medium text-gray-400">
                  Backstory
                </label>
                <textarea
                  id="backstory"
                  rows={3}
                  value={backstory}
                  onChange={(e) => setBackstory(e.target.value)}
                  className="w-full resize-none rounded-xl border border-white/10 bg-[#191927] px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#8b5cf6]/40"
                  placeholder="Born in 2347 on a space colony..."
                  required
                />
              </div>

              <div>
                <label htmlFor="speaking-style" className="mb-1.5 block text-sm font-medium text-gray-400">
                  How they speak
                </label>
                <select
                  id="speaking-style"
                  value={speakingStyle}
                  onChange={(e) => setSpeakingStyle(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#191927] px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#8b5cf6]/40"
                >
                  {speakingStyles.map((style) => (
                    <option key={style} value={style}>
                      {style}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="category" className="mb-1.5 block text-sm font-medium text-gray-400">
                  Category
                </label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#191927] px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#8b5cf6]/40"
                >
                  {categories.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <p className="mb-2 text-sm font-medium text-gray-400">Avatar Emoji</p>
                <div className="grid grid-cols-5 gap-1.5 rounded-xl border border-white/10 bg-[#171725] p-2 sm:grid-cols-10">
                  {emojiOptions.map((emoji) => {
                    const active = emoji === avatarEmoji;

                    return (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setAvatarEmoji(emoji)}
                        className={`btn-interactive flex h-9 w-full items-center justify-center rounded-lg text-lg ${
                          active
                            ? "bg-[#8b5cf6]/30 ring-1 ring-[#8b5cf6]"
                            : "bg-white/5 hover:bg-white/10 active:scale-[0.96]"
                        }`}
                        aria-label={`Use ${emoji} avatar`}
                      >
                        {emoji}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="sm:col-span-2">
                <p className="mb-2 text-sm font-medium text-gray-400">Banner color</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {gradientOptions.map((gradient) => {
                    const active = gradient === bannerGradient;

                    return (
                      <button
                        key={gradient}
                        type="button"
                        onClick={() => setBannerGradient(gradient)}
                        className={`btn-interactive h-11 rounded-lg border ${
                          active
                            ? "border-[#c7b2ff] ring-2 ring-[#8b5cf6]/60"
                            : "border-white/20 hover:border-white/40 active:scale-[0.98]"
                        }`}
                        style={{ background: gradient }}
                        aria-label="Choose banner gradient"
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-interactive mt-6 w-full rounded-xl bg-gradient-to-r from-[#8b5cf6] to-[#ec4899] px-4 py-3 text-sm font-semibold text-white hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Creating..." : "Create Character"}
            </button>
          </form>

          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-2xl border border-white/10 bg-[#11111a]/85 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                Live Preview
              </p>

              <article className="rounded-2xl border border-white/10 bg-[#141422] p-3">
                <div className="relative mb-10">
                  <div className="h-24 rounded-xl" style={{ background: bannerGradient }} />
                  <div className="absolute -bottom-7 left-3 flex h-14 w-14 items-center justify-center rounded-full border-4 border-[#141422] bg-[#23233a] text-3xl shadow-lg">
                    {avatarEmoji}
                  </div>
                  <span className="absolute right-2 top-2 rounded-full border border-white/20 bg-black/30 px-2 py-0.5 text-[11px] text-gray-100">
                    New
                  </span>
                </div>

                <h3 className="text-lg font-bold text-white">{name.trim() || "Unnamed Character"}</h3>
                <p
                  className="mt-2 text-sm text-gray-400"
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {description.trim() || "Your short description appears here."}
                </p>

                <button
                  type="button"
                  className="btn-interactive mt-4 rounded-full border border-[#8b5cf6]/70 bg-[#8b5cf6]/15 px-3 py-1.5 text-xs font-semibold text-[#e2d7ff] hover:bg-[#8b5cf6]/25 active:scale-[0.97]"
                >
                  Chat Now
                </button>
              </article>

              <div className="mt-4 rounded-xl border border-white/10 bg-[#151525] p-3">
                <p className="text-xs font-medium text-gray-400">System prompt preview</p>
                <p className="mt-2 text-xs leading-relaxed text-gray-400">{systemPrompt}</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
