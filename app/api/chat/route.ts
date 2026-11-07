import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { CLINIC, SYSTEM_PROMPT } from "@/lib/clinic";
import { getSupabase } from "@/lib/supabase";

const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

type Role = "user" | "assistant";
type ChatMessage = { role: Role; content: string };

type Part = {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
};
type Content = { role: "user" | "model"; parts: Part[] };

const BOOK_APPOINTMENT = {
  name: "book_appointment",
  description:
    "Save a confirmed appointment for a visitor. Only call this once all four details have been collected from the visitor and the requested time is within the clinic's opening hours.",
  parameters: {
    type: "OBJECT",
    properties: {
      full_name: {
        type: "STRING",
        description: "The visitor's full name, as they gave it.",
      },
      phone: {
        type: "STRING",
        description: "The visitor's contact phone number.",
      },
      department: {
        type: "STRING",
        description: "The department for the appointment.",
        enum: [...CLINIC.departments],
      },
      preferred_datetime: {
        type: "STRING",
        description:
          "The preferred date and time, in the visitor's own words, e.g. 'Tuesday 12 Nov at 4:30 pm'.",
      },
    },
    required: ["full_name", "phone", "department", "preferred_datetime"],
  },
} as const;

const ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function newBookingId(): string {
  let out = "";
  for (let i = 0; i < 6; i += 1) {
    out += ID_ALPHABET[randomInt(ID_ALPHABET.length)];
  }
  return `CCC-${out}`;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function saveAppointment(args: Record<string, unknown>) {
  const fullName = asText(args.full_name);
  const phone = asText(args.phone);
  const department = asText(args.department);
  const preferredDatetime = asText(args.preferred_datetime);

  if (!fullName || !phone || !department || !preferredDatetime) {
    return {
      status: "error" as const,
      error: "Some booking details were missing. Ask the visitor for them again.",
    };
  }

  const matched = CLINIC.departments.find(
    (d) => d.toLowerCase() === department.toLowerCase(),
  );
  if (!matched) {
    return {
      status: "error" as const,
      error: `"${department}" is not a department at the clinic. Available departments: ${CLINIC.departments.join(", ")}.`,
    };
  }

  const bookingId = newBookingId();

  try {
    const { error } = await getSupabase().from("appointments").insert({
      booking_id: bookingId,
      full_name: fullName,
      phone,
      department: matched,
      preferred_datetime: preferredDatetime,
    });

    if (error) {
      console.error("Supabase insert failed:", error.message);
      return {
        status: "error" as const,
        error: "The booking could not be saved. Apologise and ask them to try again.",
      };
    }
  } catch (err) {
    console.error("Supabase unavailable:", err);
    return {
      status: "error" as const,
      error: "The booking could not be saved. Apologise and ask them to try again.",
    };
  }

  return {
    status: "confirmed" as const,
    booking_id: bookingId,
    full_name: fullName,
    phone,
    department: matched,
    preferred_datetime: preferredDatetime,
  };
}

async function callGemini(apiKey: string, contents: Content[]) {
  const res = await fetch(
    `${API_BASE}/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        tools: [{ functionDeclarations: [BOOK_APPOINTMENT] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
      }),
    },
  );

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${detail.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: Content }[];
  };
  return data.candidates?.[0]?.content ?? null;
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "The receptionist is not configured yet. Missing GEMINI_API_KEY." },
      { status: 500 },
    );
  }

  let messages: ChatMessage[] = [];
  try {
    const body = (await request.json()) as { messages?: ChatMessage[] };
    messages = Array.isArray(body.messages) ? body.messages : [];
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const history: Content[] = messages
    .filter((m) => typeof m?.content === "string" && m.content.trim() !== "")
    .slice(-30)
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  if (history.length === 0) {
    return NextResponse.json({ error: "No message to reply to." }, { status: 400 });
  }

  try {
    const contents = [...history];
    let booking: { booking_id: string } | null = null;

    // Up to two passes: one to run a tool call, one to word the reply.
    for (let turn = 0; turn < 2; turn += 1) {
      const content = await callGemini(apiKey, contents);
      if (!content) break;

      const call = content.parts?.find((p) => p.functionCall)?.functionCall;
      if (!call) {
        const reply = (content.parts ?? [])
          .map((p) => p.text ?? "")
          .join("")
          .trim();
        return NextResponse.json({
          reply:
            reply ||
            "Sorry, I didn't catch that. Could you say it again?",
          bookingId: booking?.booking_id ?? null,
        });
      }

      if (call.name !== BOOK_APPOINTMENT.name) break;

      const result = await saveAppointment(call.args ?? {});
      if (result.status === "confirmed") booking = result;

      contents.push(content, {
        role: "user",
        parts: [
          {
            functionResponse: {
              name: BOOK_APPOINTMENT.name,
              response: result,
            },
          },
        ],
      });
    }

    return NextResponse.json({
      reply:
        "Sorry, something went wrong at my end. Could you try that once more?",
      bookingId: booking?.booking_id ?? null,
    });
  } catch (err) {
    console.error("Chat route failed:", err);
    return NextResponse.json(
      {
        error:
          "The receptionist is unavailable right now. Please try again in a moment.",
      },
      { status: 502 },
    );
  }
}
