"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  at: Date;
};

const GREETING =
  "Hello! 👋 You're chatting with the City Care Clinic front desk. How can I help you today?";

const SUGGESTIONS = [
  "Book an appointment",
  "What are your timings?",
  "Which departments do you have?",
];

function clockTime(at: Date) {
  return at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function Ticks() {
  return (
    <svg
      viewBox="0 0 16 11"
      aria-hidden="true"
      className="h-[11px] w-4 shrink-0 text-[#53bdeb]"
    >
      <path
        fill="currentColor"
        d="M11.07.65a.47.47 0 0 0-.67.01L5.26 6.2 3.3 4.2a.47.47 0 1 0-.67.66l2.3 2.35c.19.19.5.18.68-.01L11.08 1.3a.47.47 0 0 0-.01-.66Zm4.35 0a.47.47 0 0 0-.67.01L9.6 6.2l-.6-.6a.47.47 0 0 0-.67.65l.94.96c.19.19.5.18.68-.01l5.48-5.9a.47.47 0 0 0-.01-.66Z"
      />
    </svg>
  );
}

function Bubble({ message, grouped }: { message: Message; grouped: boolean }) {
  const mine = message.role === "user";

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "relative max-w-[85%] sm:max-w-[72%] px-2.5 py-1.5 wa-bubble-shadow",
          mine
            ? "bg-wa-out rounded-lg rounded-tr-none"
            : "bg-wa-in rounded-lg rounded-tl-none",
          grouped ? "rounded-tr-lg rounded-tl-lg" : mine ? "wa-tail-out" : "wa-tail-in",
        ].join(" ")}
      >
        <p className="whitespace-pre-wrap break-words text-[15px] leading-[20px] text-wa-ink">
          {message.content}
          <span className="inline-block w-[58px] select-none" />
        </p>
        <span className="absolute bottom-1 right-2.5 flex items-center gap-1 text-[11px] leading-none text-wa-muted">
          {clockTime(message.at)}
          {mine ? <Ticks /> : null}
        </span>
      </div>
    </div>
  );
}

function Typing() {
  return (
    <div className="flex justify-start">
      <div className="wa-tail-in wa-bubble-shadow relative rounded-lg rounded-tl-none bg-wa-in px-3.5 py-3">
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="wa-dot h-1.5 w-1.5 rounded-full bg-wa-muted"
              style={{ animationDelay: `${i * 0.18}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // The opening line is written by the front desk itself, not the model, so the
  // chat is never empty on arrival.
  useEffect(() => {
    setMessages([
      { id: makeId(), role: "assistant", content: GREETING, at: new Date() },
    ]);
  }, []);

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  const send = useCallback(
    async (text: string) => {
      const body = text.trim();
      if (!body || sending) return;

      const outgoing: Message = {
        id: makeId(),
        role: "user",
        content: body,
        at: new Date(),
      };
      const next = [...messages, outgoing];

      setMessages(next);
      setDraft("");
      setSending(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: next.map(({ role, content }) => ({ role, content })),
          }),
        });

        const data = (await res.json()) as { reply?: string; error?: string };
        const reply =
          data.reply ??
          data.error ??
          "Sorry, I couldn't reach the front desk just now. Please try again.";

        setMessages((prev) => [
          ...prev,
          { id: makeId(), role: "assistant", content: reply, at: new Date() },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: makeId(),
            role: "assistant",
            content:
              "Sorry, I couldn't reach the front desk just now. Please check your connection and try again.",
            at: new Date(),
          },
        ]);
      } finally {
        setSending(false);
        inputRef.current?.focus();
      }
    },
    [messages, sending],
  );

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send(draft);
    }
  };

  const showSuggestions =
    messages.length > 0 && !messages.some((m) => m.role === "user") && !sending;

  return (
    <div className="mx-auto flex h-dvh w-full max-w-2xl flex-col bg-wa-canvas sm:h-[min(100dvh,860px)] sm:my-auto sm:overflow-hidden sm:rounded-xl sm:shadow-2xl">
      {/* Header */}
      <header className="flex shrink-0 items-center gap-3 bg-wa-header px-3 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] text-white sm:rounded-t-xl">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 text-[13px] font-semibold tracking-wide">
          CC
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-[17px] font-medium leading-tight">
            City Care Clinic
          </h1>
          <p className="flex items-center gap-1.5 text-[12.5px] leading-tight text-white/85">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#25d366] opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#25d366]" />
            </span>
            online
          </p>
        </div>
        <p className="ml-auto hidden text-[12px] leading-tight text-white/75 sm:block">
          AI front desk
        </p>
      </header>

      {/* Conversation */}
      <div
        ref={scrollerRef}
        className="wa-canvas wa-scroll flex-1 overflow-y-auto overscroll-contain px-3 py-3"
      >
        <div className="mx-auto mb-3 w-fit rounded-md bg-[#ffffffcc] px-2.5 py-1 text-[11.5px] font-medium uppercase tracking-wide text-wa-muted shadow-sm">
          Today
        </div>

        <div className="flex flex-col gap-2">
          {messages.map((message, index) => (
            <Bubble
              key={message.id}
              message={message}
              grouped={messages[index - 1]?.role === message.role}
            />
          ))}
          {sending ? <Typing /> : null}
        </div>

        {showSuggestions ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {SUGGESTIONS.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => void send(label)}
                className="rounded-full border border-wa-header/25 bg-white/90 px-3.5 py-2 text-[13.5px] font-medium text-wa-header shadow-sm transition active:scale-[0.98] hover:bg-white"
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Composer */}
      <div className="shrink-0 bg-wa-bar px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:rounded-b-xl">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void send(draft);
          }}
          className="flex items-end gap-2"
        >
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Type a message"
            aria-label="Type a message"
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-[22px] bg-white px-4 py-3 text-[15px] leading-[18px] text-wa-ink placeholder:text-wa-muted focus:outline-none"
            style={{ fieldSizing: "content" } as React.CSSProperties}
          />
          <button
            type="submit"
            disabled={!draft.trim() || sending}
            aria-label="Send message"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-wa-header text-white transition enabled:active:scale-95 enabled:hover:bg-wa-header-dark disabled:opacity-45"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
              <path fill="currentColor" d="M1.1 21.8 23 12 1.1 2.2 1.09 9.8 16.6 12 1.09 14.2z" />
            </svg>
          </button>
        </form>
        <p className="mt-1.5 text-center text-[11px] text-wa-muted">
          AI receptionist · does not give medical advice
        </p>
      </div>
    </div>
  );
}
