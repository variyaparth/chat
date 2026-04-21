"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock3, Download, Image as ImageIcon, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { extractMemories } from "@/lib/memoryExtractor";
import { buildSystemPromptWithMemory } from "@/lib/memoryInjector";

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];
const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const IMAGE_WARNING_SIZE_BYTES = 2 * 1024 * 1024;

function getTraits(character) {
  const base = ["Empathetic", "Creative", "Witty", "Curious", "Supportive"];

  if (!character?.description) {
    return base.slice(0, 4);
  }

  const map = [
    { key: "romance", trait: "Romantic" },
    { key: "history", trait: "Historical" },
    { key: "adventure", trait: "Adventurous" },
    { key: "mystery", trait: "Analytical" },
    { key: "fantasy", trait: "Magical" },
    { key: "sci", trait: "Futuristic" },
  ];

  const text = character.description.toLowerCase();
  const matched = map.filter((item) => text.includes(item.key)).map((item) => item.trait);
  const merged = [...matched, ...base];

  return Array.from(new Set(merged)).slice(0, 5);
}

function formatFileSize(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function buildModelMessages(messageList) {
  return messageList.map((message) => {
    if (message.imageUrl) {
      return {
        role: message.role,
        content: [
          {
            type: "image",
            source: {
              type: "url",
              url: message.imageUrl,
            },
          },
          {
            type: "text",
            text: message.content || "What do you think of this image?",
          },
        ],
      };
    }

    return {
      role: message.role,
      content: message.content || "",
    };
  });
}

export default function CharacterChatPage({ params }) {
  const router = useRouter();
  const scrollAnchorRef = useRef(null);
  const fileInputRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const messageIdsRef = useRef([]);
  const lastExtractionCountRef = useRef(0);

  const [character, setCharacter] = useState(null);
  const [relatedCharacters, setRelatedCharacters] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [error, setError] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [characterConversations, setCharacterConversations] = useState([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDrawerLoading, setIsDrawerLoading] = useState(false);
  const [showLoginBanner, setShowLoginBanner] = useState(false);
  const [abortController, setAbortController] = useState(null);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [memoryCount, setMemoryCount] = useState(0);
  const [showMemoryToast, setShowMemoryToast] = useState(false);
  const [isExtractingMemories, setIsExtractingMemories] = useState(false);

  const [reactionsByMessage, setReactionsByMessage] = useState({});
  const [activeReactionPickerMessageId, setActiveReactionPickerMessageId] = useState(null);

  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [selectedImagePreviewUrl, setSelectedImagePreviewUrl] = useState("");
  const [imageWarning, setImageWarning] = useState("");
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [lightboxImageUrl, setLightboxImageUrl] = useState("");

  const characterId = params?.id;

  async function fetchCharacterConversations(userId, selectedCharacterId) {
    const { data, error: listError } = await supabase
      .from("conversations")
      .select("id, last_message_at, message_count, created_at")
      .eq("user_id", userId)
      .eq("character_id", selectedCharacterId)
      .order("last_message_at", { ascending: false });

    if (listError) {
      throw listError;
    }

    setCharacterConversations(data || []);
    return data || [];
  }

  async function fetchReactionsForMessageIds(messageIds) {
    if (!messageIds || messageIds.length === 0) {
      setReactionsByMessage({});
      return;
    }

    const { data, error: reactionsError } = await supabase
      .from("message_reactions")
      .select("message_id, emoji, user_id")
      .in("message_id", messageIds);

    if (reactionsError) {
      return;
    }

    const grouped = {};

    for (const row of data || []) {
      if (!grouped[row.message_id]) {
        grouped[row.message_id] = {};
      }

      if (!grouped[row.message_id][row.emoji]) {
        grouped[row.message_id][row.emoji] = {
          emoji: row.emoji,
          count: 0,
          userIds: [],
        };
      }

      grouped[row.message_id][row.emoji].count += 1;
      grouped[row.message_id][row.emoji].userIds.push(row.user_id);
    }

    setReactionsByMessage(grouped);
  }

  async function loadMessagesForConversation(activeConversationId, activeUserId) {
    const { data: storedMessages, error: loadMessagesError } = await supabase
      .from("messages")
      .select("id, role, content, image_url, created_at")
      .eq("conversation_id", activeConversationId)
      .eq("user_id", activeUserId)
      .order("created_at", { ascending: true });

    if (loadMessagesError) {
      throw loadMessagesError;
    }

    const normalizedMessages = (storedMessages || []).map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      imageUrl: message.image_url || null,
      timestamp: new Date(message.created_at).getTime(),
    }));

    setMessages(normalizedMessages);

    const messageIds = normalizedMessages.map((message) => message.id);
    await fetchReactionsForMessageIds(messageIds);
    lastExtractionCountRef.current = normalizedMessages.length;
  }

  function showMemoryToastOnce() {
    setShowMemoryToast(true);
    setTimeout(() => setShowMemoryToast(false), 2000);
  }

  async function fetchMemoryCount(userId, selectedCharacterId) {
    const { count } = await supabase
      .from("memories")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("character_id", selectedCharacterId);

    setMemoryCount(count || 0);
    return count || 0;
  }

  function getMemoryKeyword(text) {
    const parts = String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((part) => part.length > 3)
      .slice(0, 3);

    return parts[0] || "";
  }

  async function extractAndSaveMemories(targetMessages, user, selectedCharacter) {
    if (!user || !selectedCharacter || isExtractingMemories) {
      return;
    }

    setIsExtractingMemories(true);

    try {
      const { data: existingMemories } = await supabase
        .from("memories")
        .select("id, memory_text, importance")
        .eq("user_id", user.id)
        .eq("character_id", selectedCharacter.id);

      const extracted = await extractMemories(targetMessages, existingMemories || []);

      if (!extracted.length) {
        return;
      }

      for (const memory of extracted) {
        const keyword = getMemoryKeyword(memory.memory_text);

        let similarRows = [];

        if (keyword) {
          const { data } = await supabase
            .from("memories")
            .select("id, memory_text, importance")
            .eq("user_id", user.id)
            .eq("character_id", selectedCharacter.id)
            .ilike("memory_text", `%${keyword}%`)
            .limit(1);

          similarRows = data || [];
        }

        if (similarRows.length > 0) {
          const existing = similarRows[0];

          await supabase
            .from("memories")
            .update({
              memory_text: memory.memory_text,
              category: memory.category || "general",
              importance: Math.max(existing.importance || 1, memory.importance || 1),
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
        } else {
          await supabase.from("memories").insert({
            user_id: user.id,
            character_id: selectedCharacter.id,
            memory_text: memory.memory_text,
            category: memory.category || "general",
            importance: memory.importance || 1,
          });
        }
      }

      const newCount = await fetchMemoryCount(user.id, selectedCharacter.id);

      const nextPrompt = await buildSystemPromptWithMemory(
        selectedCharacter.system_prompt,
        user.id,
        selectedCharacter.id,
        supabase
      );

      setSystemPrompt(nextPrompt);

      if (newCount > 0) {
        showMemoryToastOnce();
      }
    } catch {
      // Ignore extractor failures to avoid blocking chat UX.
    } finally {
      setIsExtractingMemories(false);
    }
  }

  const traits = useMemo(() => getTraits(character), [character]);

  useEffect(() => {
    let ignore = false;

    async function loadCharacter() {
      setIsLoading(true);
      setIsLoadingHistory(true);
      setError("");

      const { data, error: characterError } = await supabase
        .from("characters")
        .select("id, name, description, system_prompt, avatar_emoji, banner_gradient, chat_count")
        .eq("id", characterId)
        .single();

      if (ignore) {
        return;
      }

      if (characterError || !data) {
        setError("Character not found.");
        setCharacter(null);
        setMessages([]);
        setIsLoading(false);
        return;
      }

      setCharacter(data);

      const { data: relatedData } = await supabase
        .from("characters")
        .select("id, name, description, avatar_emoji")
        .neq("id", characterId)
        .limit(3);

      if (!ignore) {
        setRelatedCharacters(relatedData || []);

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (ignore) {
          return;
        }

        setCurrentUser(user || null);

        if (!user) {
          setShowLoginBanner(true);
          setConversationId(null);
          setMessages([]);
          setIsLoadingHistory(false);
          setIsLoading(false);
          return;
        }

        setShowLoginBanner(false);

        const enhancedPrompt = await buildSystemPromptWithMemory(
          data.system_prompt,
          user.id,
          data.id,
          supabase
        );

        setSystemPrompt(enhancedPrompt);

        const memoryTotal = await fetchMemoryCount(user.id, data.id);

        let conversationRows = [];

        try {
          conversationRows = await fetchCharacterConversations(user.id, data.id);
        } catch {
          setError("Could not load conversation history.");
          setIsLoadingHistory(false);
          setIsLoading(false);
          return;
        }

        if (ignore) {
          return;
        }

        let activeConversationId = conversationRows?.[0]?.id || null;

        if (!activeConversationId) {
          const { data: insertedConversation, error: createConversationError } = await supabase
            .from("conversations")
            .insert({
              user_id: user.id,
              character_id: data.id,
              title: `${data.name} chat`,
              message_count: 0,
            })
            .select("id")
            .single();

          if (ignore) {
            return;
          }

          if (createConversationError || !insertedConversation?.id) {
            setError("Could not create conversation.");
            setIsLoadingHistory(false);
            setIsLoading(false);
            return;
          }

          activeConversationId = insertedConversation.id;
          setCharacterConversations((prev) => [
            {
              id: insertedConversation.id,
              last_message_at: null,
              message_count: 0,
              created_at: new Date().toISOString(),
            },
            ...prev,
          ]);
        }

        setConversationId(activeConversationId);

        try {
          await loadMessagesForConversation(activeConversationId, user.id);
        } catch {
          setError("Could not load previous messages.");
          setMessages([]);
        }

        const { data: checkExistingMessages } = await supabase
          .from("messages")
          .select("id")
          .eq("conversation_id", activeConversationId)
          .eq("user_id", user.id)
          .limit(1);

        if ((checkExistingMessages || []).length === 0) {
          let introText = `Hi, I am ${data.name}. ${
            data.description || "Ask me anything and let us start our story."
          }`;

          if (memoryTotal > 0) {
            try {
              const greetingResponse = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  messages: [
                    {
                      role: "user",
                      content:
                        "Write a warm one sentence welcome-back greeting using what you remember about me.",
                    },
                  ],
                  systemPrompt: enhancedPrompt,
                }),
              });

              if (greetingResponse.ok) {
                introText = ((await greetingResponse.text()) || introText).trim();
              }
            } catch {
              // Fallback to default intro text.
            }
          } else {
            introText = `${introText} Before we dive in, what should I call you?`;
          }

          const { data: introMessageRow } = await supabase
            .from("messages")
            .insert({
              conversation_id: activeConversationId,
              user_id: user.id,
              character_id: data.id,
              role: "assistant",
              content: introText,
            })
            .select("id, created_at")
            .single();

          if (introMessageRow) {
            setMessages([
              {
                id: introMessageRow.id,
                role: "assistant",
                content: introText,
                imageUrl: null,
                timestamp: new Date(introMessageRow.created_at).getTime(),
              },
            ]);
          }
        }

        setIsLoadingHistory(false);
        setIsLoading(false);
      }
    }

    if (characterId) {
      loadCharacter();
    }

    return () => {
      ignore = true;
    };
  }, [characterId]);

  useEffect(() => {
    if (!currentUser || !character || isTyping || isExtractingMemories) {
      return;
    }

    const finalizedCount = messages.filter((message) => !message.uploadingImage && !message.isStreaming).length;

    if (finalizedCount > 0 && finalizedCount % 5 === 0 && finalizedCount !== lastExtractionCountRef.current) {
      lastExtractionCountRef.current = finalizedCount;
      extractAndSaveMemories(messages, currentUser, character);
    }
  }, [messages, currentUser, character, isTyping, isExtractingMemories]);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    messageIdsRef.current = messages
      .map((message) => message.id)
      .filter((id) => /^[0-9a-fA-F-]{36}$/.test(String(id)));
  }, [messages]);

  useEffect(() => {
    if (!currentUser || !conversationId) {
      return;
    }

    const channel = supabase
      .channel(`message-reactions-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions" },
        async () => {
          await fetchReactionsForMessageIds(messageIdsRef.current);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, currentUser]);

  useEffect(() => {
    return () => {
      if (selectedImagePreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(selectedImagePreviewUrl);
      }
    };
  }, [selectedImagePreviewUrl]);

  function clearSelectedImage() {
    if (selectedImagePreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(selectedImagePreviewUrl);
    }

    setSelectedImageFile(null);
    setSelectedImagePreviewUrl("");
    setImageWarning("");
  }

  function handleImageFile(file) {
    if (!file) {
      return;
    }

    if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
      setError("Unsupported format. Please upload JPG, PNG, GIF, or WEBP.");
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setError("Image is too large. Maximum file size is 5MB.");
      return;
    }

    if (selectedImagePreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(selectedImagePreviewUrl);
    }

    setSelectedImageFile(file);
    setSelectedImagePreviewUrl(URL.createObjectURL(file));
    setImageWarning(
      file.size > IMAGE_WARNING_SIZE_BYTES
        ? `Large image (${formatFileSize(file.size)}). Upload may be slower.`
        : ""
    );
    setError("");
  }

  function handleImageInputChange(event) {
    const file = event.target.files?.[0];
    handleImageFile(file);
    event.target.value = "";
  }

  async function handleSendMessage() {
    const trimmed = input.trim();

    if ((!trimmed && !selectedImageFile) || !character || isTyping) {
      return;
    }

    if (trimmed.length > 4000) {
      setError("Message is too long.");
      return;
    }

    if (!currentUser || !conversationId) {
      setShowLoginBanner(true);
      return;
    }

    const optimisticMessageId = `temp-user-${Date.now()}`;

    const userMessage = {
      id: optimisticMessageId,
      role: "user",
      content: trimmed,
      imageUrl: selectedImagePreviewUrl || null,
      uploadingImage: Boolean(selectedImageFile),
      timestamp: Date.now(),
    };

    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput("");
    setIsTyping(true);

    const pendingImageFile = selectedImageFile;
    clearSelectedImage();

    try {
      let streamedAssistantText = "";

      let uploadedImageUrl = null;

      if (pendingImageFile) {
        const cleanName = pendingImageFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const filePath = `${currentUser.id}/${Date.now()}-${cleanName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("chat-images")
          .upload(filePath, pendingImageFile);

        if (uploadError) {
          throw new Error("Failed to upload image.");
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("chat-images").getPublicUrl(uploadData.path);

        uploadedImageUrl = publicUrl;

        setMessages((prev) =>
          prev.map((message) =>
            message.id === optimisticMessageId
              ? { ...message, imageUrl: uploadedImageUrl, uploadingImage: false }
              : message
          )
        );
      }

      const { data: savedUserMessage, error: userInsertError } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          user_id: currentUser.id,
          character_id: character.id,
          role: "user",
          content: trimmed || "",
          image_url: uploadedImageUrl,
        })
        .select("id, created_at, image_url")
        .single();

      if (userInsertError) {
        throw new Error("Failed to save your message");
      }

      const nextForModel = nextMessages.map((message) =>
        message.id === optimisticMessageId
          ? { ...message, id: savedUserMessage.id, imageUrl: uploadedImageUrl, uploadingImage: false }
          : message
      );

      setMessages((prev) => {
        const updated = [...prev];
        const index = updated.findIndex((message) => message.id === optimisticMessageId);

        if (index >= 0) {
          updated[index] = {
            ...updated[index],
            id: savedUserMessage.id,
            imageUrl: savedUserMessage.image_url || uploadedImageUrl,
            uploadingImage: false,
            timestamp: new Date(savedUserMessage.created_at).getTime(),
          };
        }

        return updated;
      });

      const streamingAssistantMessageId = `temp-assistant-${Date.now()}`;

      setMessages((prev) => [
        ...prev,
        {
          id: streamingAssistantMessageId,
          role: "assistant",
          content: "",
          imageUrl: null,
          isStreaming: true,
          timestamp: Date.now(),
        },
      ]);

      const controller = new AbortController();
      setAbortController(controller);

      const response = await fetch("/api/chat", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: buildModelMessages(nextForModel),
          systemPrompt: systemPrompt || character.system_prompt,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get AI response");
      }

      if (!response.body) {
        throw new Error("Streaming response body unavailable");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        streamedAssistantText += decoder.decode(value, { stream: true });

        setMessages((prev) => {
          const updated = [...prev];
          const lastIndex = updated.findIndex((message) => message.id === streamingAssistantMessageId);

          if (lastIndex >= 0) {
            updated[lastIndex] = {
              ...updated[lastIndex],
              content: streamedAssistantText,
              timestamp: Date.now(),
            };
          }

          return updated;
        });
      }

      streamedAssistantText += decoder.decode();

      const aiText = streamedAssistantText.trim() || "I am here. Tell me more.";

      const { data: savedAssistantMessage, error: assistantInsertError } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          user_id: currentUser.id,
          character_id: character.id,
          role: "assistant",
          content: aiText,
          image_url: null,
        })
        .select("id, created_at")
        .single();

      if (assistantInsertError) {
        throw new Error("Failed to save AI response");
      }

      const preview = aiText.slice(0, 100);

      const { data: conversationRow } = await supabase
        .from("conversations")
        .select("message_count")
        .eq("id", conversationId)
        .eq("user_id", currentUser.id)
        .single();

      const nextMessageCount = (conversationRow?.message_count || 0) + 1;

      const { error: updateConversationError } = await supabase
        .from("conversations")
        .update({
          last_message: preview,
          last_message_at: new Date().toISOString(),
          message_count: nextMessageCount,
        })
        .eq("id", conversationId)
        .eq("user_id", currentUser.id);

      if (updateConversationError) {
        throw new Error("Failed to update conversation");
      }

      setCharacterConversations((prev) => {
        const updated = prev.map((item) =>
          item.id === conversationId
            ? {
                ...item,
                message_count: nextMessageCount,
                last_message_at: new Date().toISOString(),
              }
            : item
        );

        return updated.sort((a, b) => {
          const aTime = new Date(a.last_message_at || a.created_at || 0).getTime();
          const bTime = new Date(b.last_message_at || b.created_at || 0).getTime();
          return bTime - aTime;
        });
      });

      setMessages((prev) =>
        prev.map((message) =>
          message.id === streamingAssistantMessageId
            ? {
                ...message,
                id: savedAssistantMessage.id,
                content: aiText,
                isStreaming: false,
                timestamp: new Date(savedAssistantMessage.created_at).getTime(),
              }
            : message
        )
      );
      setShowLoginBanner(false);

      const finalizedCount = nextForModel.length + 1;
      if (finalizedCount % 5 === 0) {
        extractAndSaveMemories(
          [
            ...nextForModel,
            {
              role: "assistant",
              content: aiText,
              imageUrl: null,
            },
          ],
          currentUser,
          character
        );
      }
    } catch (sendError) {
      const isAborted = sendError?.name === "AbortError";

      if (isAborted) {
        setMessages((prev) =>
          prev.map((message) => (message.isStreaming ? { ...message, isStreaming: false } : message))
        );
      }

      setMessages((prev) =>
        prev.map((message) =>
          message.id === optimisticMessageId ? { ...message, uploadingImage: false } : message
        )
      );

      if (!isAborted) {
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-error-${Date.now()}`,
            role: "assistant",
            content: "I hit a temporary issue. Can you send that again?",
            imageUrl: null,
            timestamp: Date.now(),
          },
        ]);
        setError(sendError.message || "Message failed to send.");
      }
    } finally {
      setAbortController(null);
      setIsTyping(false);
    }
  }

  function handleStopGenerating() {
    abortController?.abort();
  }

  function onInputKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  }

  function getReactionsForMessage(messageId) {
    return Object.values(reactionsByMessage[messageId] || {}).sort((a, b) => a.emoji.localeCompare(b.emoji));
  }

  async function handleReactionSelect(messageId, selectedEmoji) {
    if (!currentUser || !/^[0-9a-fA-F-]{36}$/.test(String(messageId))) {
      setShowLoginBanner(true);
      setActiveReactionPickerMessageId(null);
      return;
    }

    const reactions = reactionsByMessage[messageId] || {};
    const existing = reactions[selectedEmoji];
    const hasReacted = existing?.userIds?.includes(currentUser.id);

    if (hasReacted) {
      await supabase
        .from("message_reactions")
        .delete()
        .eq("message_id", messageId)
        .eq("user_id", currentUser.id)
        .eq("emoji", selectedEmoji);
    } else {
      await supabase.from("message_reactions").upsert(
        {
          message_id: messageId,
          user_id: currentUser.id,
          emoji: selectedEmoji,
        },
        { onConflict: "message_id,user_id,emoji" }
      );
    }

    await fetchReactionsForMessageIds(messageIdsRef.current);
    setActiveReactionPickerMessageId(null);
  }

  function handleTouchStartForMessage(messageId) {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    longPressTimerRef.current = setTimeout(() => {
      setActiveReactionPickerMessageId(messageId);
    }, 450);
  }

  function clearLongPressTimer() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  async function handleSelectConversation(nextConversationId) {
    if (!currentUser || nextConversationId === conversationId) {
      setIsDrawerOpen(false);
      return;
    }

    setIsDrawerLoading(true);
    setError("");

    try {
      await loadMessagesForConversation(nextConversationId, currentUser.id);
      setConversationId(nextConversationId);
      setIsDrawerOpen(false);
    } catch {
      setError("Could not load selected conversation.");
    } finally {
      setIsDrawerLoading(false);
    }
  }

  function handleDropImage(event) {
    event.preventDefault();
    setIsDraggingImage(false);

    const file = event.dataTransfer.files?.[0];
    handleImageFile(file);
  }

  return (
    <div className="h-[calc(100dvh-109px)] overflow-hidden md:h-[calc(100dvh-73px)]">
      <div className="mx-auto flex h-full w-full max-w-7xl gap-4 px-3 py-3 sm:px-4 lg:px-6">
        {currentUser ? (
          <>
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="btn-interactive fixed bottom-5 left-4 z-40 inline-flex items-center gap-2 rounded-full border border-[#8b5cf6]/50 bg-[#151525]/90 px-3 py-2 text-xs font-medium text-[#e2d7ff] shadow-lg backdrop-blur hover:bg-[#1d1d33] sm:left-6 sm:text-sm"
            >
              <Clock3 className="h-4 w-4" />
              Chat History
            </button>

            <div
              className={`fixed inset-0 z-40 bg-black/40 transition-opacity ${
                isDrawerOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
              }`}
              onClick={() => setIsDrawerOpen(false)}
            />

            <aside
              className={`fixed left-0 top-0 z-50 h-full w-[300px] border-r border-white/10 bg-[#0f0f18] p-4 shadow-2xl transition-transform duration-300 ${
                isDrawerOpen ? "translate-x-0" : "-translate-x-full"
              }`}
            >
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-semibold text-white">Past Conversations</p>
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="btn-interactive inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-gray-300 hover:bg-white/10"
                  aria-label="Close conversation drawer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2 overflow-y-auto">
                {isDrawerLoading ? <p className="text-sm text-gray-400">Loading conversation...</p> : null}

                {characterConversations.length === 0 ? (
                  <p className="text-sm text-gray-400">No saved conversations for this character yet.</p>
                ) : null}

                {characterConversations.map((item) => {
                  const isActive = item.id === conversationId;
                  const labelDate = item.last_message_at || item.created_at;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectConversation(item.id)}
                      className={`btn-interactive w-full rounded-xl border px-3 py-2 text-left ${
                        isActive
                          ? "border-[#8b5cf6]/60 bg-[#8b5cf6]/15"
                          : "border-white/10 bg-white/5 hover:border-[#8b5cf6]/45"
                      }`}
                    >
                      <p className="text-xs text-gray-400">
                        {new Date(labelDate).toLocaleDateString()} {new Date(labelDate).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      <p className="mt-1 text-sm text-white">{item.message_count || 0} messages</p>
                    </button>
                  );
                })}
              </div>
            </aside>
          </>
        ) : null}

        <aside className="hidden h-full w-[280px] shrink-0 overflow-y-auto rounded-2xl border border-white/10 bg-[#10101a]/85 p-4 lg:block">
          {character ? (
            <div className="rounded-xl border border-white/10 bg-[#151525]/80 p-4">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#23233a] text-2xl">
                  {character.avatar_emoji || "🤖"}
                </div>
                <div>
                  <p className="text-base font-semibold text-white">{character.name}</p>
                  <p className="text-xs text-gray-400">Character Profile</p>
                </div>
              </div>
              <p className="text-sm text-gray-400">{character.description || "No description available."}</p>
            </div>
          ) : null}

          <section className="mt-4 rounded-xl border border-white/10 bg-[#141422]/70 p-4">
            <h2 className="text-sm font-semibold text-white">About this character</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {traits.map((trait) => (
                <span
                  key={trait}
                  className="rounded-full border border-[#8b5cf6]/50 bg-[#8b5cf6]/15 px-3 py-1 text-xs font-medium text-[#dfd2ff]"
                >
                  {trait}
                </span>
              ))}
            </div>
          </section>

          <section className="mt-4 rounded-xl border border-white/10 bg-[#141422]/70 p-4">
            <Link
              href={`/memories/${characterId}`}
              className="btn-interactive inline-flex items-center gap-2 rounded-full border border-[#8b5cf6]/40 bg-[#8b5cf6]/15 px-3 py-1.5 text-xs font-medium text-[#e2d7ff] hover:bg-[#8b5cf6]/25"
            >
              <span>🧠</span>
              View memories ({memoryCount})
            </Link>
          </section>

          <section className="mt-4 rounded-xl border border-white/10 bg-[#141422]/70 p-4">
            <h2 className="text-sm font-semibold text-white">Other characters you may like</h2>
            <div className="mt-3 space-y-2">
              {relatedCharacters.map((item) => (
                <Link
                  key={item.id}
                  href={`/chat/${item.id}`}
                  className="btn-interactive block rounded-lg border border-white/10 bg-[#1a1a2b]/70 p-3 hover:border-[#8b5cf6]/60 hover:bg-[#1f1f35] active:scale-[0.99]"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#292945] text-base">
                      {item.avatar_emoji || "✨"}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{item.name}</p>
                      <p className="truncate text-xs text-gray-400">{item.description || "Start a new chat"}</p>
                    </div>
                  </div>
                </Link>
              ))}

              {relatedCharacters.length === 0 ? <p className="text-xs text-gray-400">No suggestions yet.</p> : null}
            </div>
          </section>
        </aside>

        <section
          className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0f0f18]/90"
          onDragOver={(event) => {
            event.preventDefault();
            setIsDraggingImage(true);
          }}
          onDragLeave={() => setIsDraggingImage(false)}
          onDrop={handleDropImage}
        >
          {isDraggingImage ? (
            <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-[#0a0a0f]/75">
              <div className="rounded-2xl border border-[#8b5cf6]/60 bg-[#171725]/90 px-5 py-3 text-sm font-medium text-[#dfd2ff]">
                Drop image to attach
              </div>
            </div>
          ) : null}

          <header className="flex items-center justify-between border-b border-white/10 px-3 py-3 sm:px-4">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => router.back()}
                className="btn-interactive inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-gray-200 hover:bg-white/10 active:scale-[0.95]"
                aria-label="Go back"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18L9 12L15 6" />
                </svg>
              </button>

              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#24243b] text-xl">
                {character?.avatar_emoji || "🤖"}
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white sm:text-base">
                  {character?.name || "Loading..."}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-emerald-300">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                  Online
                </div>
              </div>
            </div>
          </header>

          <div className="chat-scroll flex-1 overflow-y-auto px-3 py-4 sm:px-5">
            {isLoading ? <div className="mt-8 text-center text-sm text-gray-400">Loading character...</div> : null}

            {!isLoading && isLoadingHistory ? (
              <div className="mt-8 text-center text-sm text-gray-400">Loading previous messages...</div>
            ) : null}

            {showLoginBanner ? (
              <div className="mb-4 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-200">
                Login to save chats
              </div>
            ) : null}

            {error && !character ? (
              <div className="mt-8 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-center text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <div className="flex flex-col gap-3">
              {messages.map((message) => {
                const isUser = message.role === "user";
                const reactions = getReactionsForMessage(message.id);
                const pickerOpen = activeReactionPickerMessageId === message.id;

                return (
                  <div
                    key={message.id}
                    className={`message-slide-in group flex ${isUser ? "justify-end" : "justify-start"}`}
                    onTouchStart={() => handleTouchStartForMessage(message.id)}
                    onTouchEnd={clearLongPressTimer}
                    onTouchCancel={clearLongPressTimer}
                  >
                    {!isUser ? (
                      <div className="mr-2 mt-1 hidden h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2b2b46] text-sm sm:flex">
                        {character?.avatar_emoji || "🤖"}
                      </div>
                    ) : null}

                    <div className="relative max-w-[85%] sm:max-w-[72%]">
                      <button
                        type="button"
                        onClick={() =>
                          setActiveReactionPickerMessageId((prev) => (prev === message.id ? null : message.id))
                        }
                        className="btn-interactive absolute -top-4 right-2 z-10 hidden h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-[#171725] text-sm text-gray-300 opacity-0 shadow-lg transition-all hover:text-white group-hover:inline-flex group-hover:opacity-100"
                        aria-label="Add reaction"
                      >
                        +
                      </button>

                      {pickerOpen ? (
                        <div className="reaction-picker-enter absolute -top-14 right-0 z-20 flex items-center gap-1 rounded-full border border-white/10 bg-[#141422]/95 px-2 py-1 shadow-xl backdrop-blur">
                          {REACTION_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => handleReactionSelect(message.id, emoji)}
                              className="btn-interactive inline-flex h-7 w-7 items-center justify-center rounded-full text-sm hover:bg-white/10"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      ) : null}

                      <div
                        className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                          isUser
                            ? "rounded-br-md bg-[#8b5cf6] text-white"
                            : "rounded-bl-md border border-white/10 bg-[#1a1a2a] text-gray-400"
                        }`}
                      >
                        {message.uploadingImage ? (
                          <div className="skeleton h-[160px] w-[240px] max-w-[280px] rounded-xl" />
                        ) : null}

                        {message.imageUrl && !message.uploadingImage ? (
                          <button
                            type="button"
                            onClick={() => setLightboxImageUrl(message.imageUrl)}
                            className="mb-2 block"
                          >
                            <img
                              src={message.imageUrl}
                              alt="Shared message attachment"
                              className="max-w-[280px] rounded-xl object-cover"
                            />
                          </button>
                        ) : null}

                        {message.content || message.isStreaming ? (
                          <p className="whitespace-pre-wrap">
                            {message.content}
                            {message.isStreaming ? <span className="stream-cursor">▊</span> : null}
                          </p>
                        ) : null}
                      </div>

                      {reactions.length > 0 ? (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {reactions.map((reaction) => {
                            const reactedByCurrentUser = reaction.userIds.includes(currentUser?.id);

                            return (
                              <button
                                key={`${message.id}-${reaction.emoji}`}
                                type="button"
                                onClick={() => handleReactionSelect(message.id, reaction.emoji)}
                                className={`reaction-pill-pop btn-interactive inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-white ${
                                  reactedByCurrentUser
                                    ? "border-[#8b5cf6]/70 bg-[#8b5cf6]/30"
                                    : "border-white/10 bg-[#1d1d2d] hover:bg-[#27273d]"
                                }`}
                              >
                                <span>{reaction.emoji}</span>
                                <span className="reaction-count-bounce">{reaction.count}</span>
                              </button>
                            );
                          })}
                        </div>
                      ) : null}

                      <p className="mt-1 px-1 text-[11px] text-gray-500 opacity-0 transition group-hover:opacity-100">
                        {new Date(message.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}

              {isTyping ? (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <span className="text-xl leading-none">{character?.avatar_emoji || "🤖"}</span>
                  <span>
                    {character?.name || "Character"} is typing
                    <span className="ml-1 inline-flex items-center">
                      <span className="typing-dot mr-0.5 h-1.5 w-1.5 rounded-full bg-[#8b5cf6]" />
                      <span
                        className="typing-dot mr-0.5 h-1.5 w-1.5 rounded-full bg-[#8b5cf6]"
                        style={{ animationDelay: "0.15s" }}
                      />
                      <span
                        className="typing-dot h-1.5 w-1.5 rounded-full bg-[#8b5cf6]"
                        style={{ animationDelay: "0.3s" }}
                      />
                    </span>
                  </span>
                </div>
              ) : null}

              <div ref={scrollAnchorRef} />
            </div>
          </div>

          <footer className="border-t border-white/10 p-3 sm:p-4">
            {selectedImagePreviewUrl ? (
              <div className="mb-3 flex items-start gap-3 rounded-xl border border-white/10 bg-[#171725]/80 p-2.5">
                <img
                  src={selectedImagePreviewUrl}
                  alt="Selected upload preview"
                  className="h-20 w-20 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white">Image ready to send</p>
                  {selectedImageFile ? (
                    <p className="mt-1 text-xs text-gray-400">{formatFileSize(selectedImageFile.size)}</p>
                  ) : null}
                  {imageWarning ? <p className="mt-1 text-xs text-amber-300">{imageWarning}</p> : null}
                </div>
                <button
                  type="button"
                  onClick={clearSelectedImage}
                  className="btn-interactive inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/15 text-gray-300 hover:bg-white/10"
                  aria-label="Remove selected image"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : null}

            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#181827]/95 px-2 py-2 sm:px-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageInputChange}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-interactive inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-400 hover:bg-white/10 hover:text-white active:scale-[0.95]"
                aria-label="Upload image"
              >
                <ImageIcon className="h-5 w-5" />
              </button>

              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder={currentUser ? `Message ${character?.name || "character"}...` : "Login to save chats"}
                disabled={!currentUser || isTyping}
                className="h-10 min-w-0 flex-1 bg-transparent px-1 text-sm text-white outline-none placeholder:text-gray-500"
              />

              <button
                type="button"
                onClick={handleSendMessage}
                disabled={
                  (!input.trim() && !selectedImageFile) ||
                  isTyping ||
                  !character ||
                  !currentUser ||
                  !conversationId
                }
                className="btn-interactive inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#8b5cf6] text-white hover:bg-[#7c4df1] active:scale-[0.95] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Send message"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12H19" />
                  <path d="M12 5L19 12L12 19" />
                </svg>
              </button>
            </div>

            {isTyping && abortController ? (
              <div className="mt-2 flex justify-center">
                <button
                  type="button"
                  onClick={handleStopGenerating}
                  className="btn-interactive rounded-full border border-red-500/40 bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-200 hover:bg-red-500/25"
                >
                  Stop generating
                </button>
              </div>
            ) : null}

            {error && character ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
          </footer>
        </section>
      </div>

      {lightboxImageUrl ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4">
          <button
            type="button"
            onClick={() => setLightboxImageUrl("")}
            className="btn-interactive absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/30 text-white hover:bg-black/50"
            aria-label="Close image viewer"
          >
            <X className="h-5 w-5" />
          </button>

          <a
            href={lightboxImageUrl}
            download
            className="btn-interactive absolute right-16 top-4 inline-flex h-10 items-center gap-2 rounded-full border border-white/20 bg-black/30 px-3 text-sm text-white hover:bg-black/50"
          >
            <Download className="h-4 w-4" />
            Download
          </a>

          <img src={lightboxImageUrl} alt="Full screen shared image" className="max-h-[90vh] max-w-[95vw] rounded-xl" />
        </div>
      ) : null}

      {showMemoryToast ? (
        <div className="fixed bottom-6 left-6 z-[90] memory-toast-enter rounded-full border border-[#8b5cf6]/60 bg-[#161625]/95 px-3 py-2 text-xs font-medium text-[#e4d8ff] shadow-[0_0_25px_rgba(139,92,246,0.35)]">
          🧠 I&apos;ll remember that!
        </div>
      ) : null}
    </div>
  );
}
