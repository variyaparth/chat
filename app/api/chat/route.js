import Anthropic from "@anthropic-ai/sdk";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const rateLimitBuckets = new Map();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;

function isValidMessage(message) {
  if (!message || typeof message !== "object") {
    return false;
  }

  const validRole = message.role === "user" || message.role === "assistant";
  const validContent =
    typeof message.content === "string" ||
    (Array.isArray(message.content) && message.content.length > 0);

  return validRole && validContent;
}

function isRateLimited(userId) {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(userId) || [];
  const freshBucket = bucket.filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);

  if (freshBucket.length >= RATE_LIMIT_MAX_REQUESTS) {
    rateLimitBuckets.set(userId, freshBucket);
    return true;
  }

  freshBucket.push(now);
  rateLimitBuckets.set(userId, freshBucket);
  return false;
}

export async function POST(request) {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (isRateLimited(user.id)) {
      return Response.json({ error: "Too many requests" }, { status: 429 });
    }

    const { messages, systemPrompt, imageUrl, userText } = await request.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: "Invalid messages payload" }, { status: 400 });
    }

    if (typeof systemPrompt !== "string" || systemPrompt.trim().length === 0) {
      return Response.json({ error: "Invalid system prompt" }, { status: 400 });
    }

    if (!messages.every(isValidMessage)) {
      return Response.json({ error: "Invalid message format" }, { status: 400 });
    }

    if (imageUrl && typeof imageUrl !== "string") {
      return Response.json({ error: "Invalid image URL" }, { status: 400 });
    }

    if (userText && typeof userText !== "string") {
      return Response.json({ error: "Invalid image text" }, { status: 400 });
    }

    const normalizedMessages = Array.isArray(messages) ? [...messages] : [];

    if (imageUrl) {
      normalizedMessages.push({
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "url",
              url: imageUrl,
            },
          },
          {
            type: "text",
            text: userText || "What do you think of this image?",
          },
        ],
      });
    }

    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      messages: normalizedMessages,
    });

    const readableStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          for await (const chunk of stream) {
            if (chunk.type === "content_block_delta" && chunk.delta?.type === "text_delta") {
              controller.enqueue(encoder.encode(chunk.delta.text));
            }
          }

          controller.close();
        } catch (streamError) {
          controller.error(streamError);
        }
      },
      cancel() {
        stream.controller.abort();
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("/api/chat error:", error);

    return Response.json({ error: "Streaming failed" }, { status: 500 });
  }
}
