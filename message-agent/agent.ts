import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { Spectrum } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";
import { inMemoryStore, withConfigure } from "@configure-ai/spectrum-ts";

// Three pieces: Spectrum is the phone, Configure is the memory, Claude is the brain.
const claude = new Anthropic(); // reads ANTHROPIC_API_KEY

// A normal Spectrum app — Photon carries the iMessage channel. We own this loop.
const app = await Spectrum({
  projectId: process.env.PHOTON_PROJECT_ID!,
  projectSecret: process.env.PHOTON_PROJECT_SECRET!,
  providers: [imessage.config()],
});

// One adapter call adds Configure identity + memory at the message boundary.
// It does NOT take over the loop or the model — we still write both, below.
const configureSpectrum = withConfigure({
  apiKey: process.env.CONFIGURE_API_KEY!,
  publishableKey: process.env.CONFIGURE_PUBLISHABLE_KEY!,
  agent: process.env.CONFIGURE_AGENT!,
  store: inMemoryStore(), // Dev only. Use a durable store in production (see the adapter's docs/production.md).
  signIn: {
    displayName: "Configure",
    agentPhone: process.env.AGENT_PHONE_NUMBER,
  },
  connect: {
    mode: "intent", // if someone texts "connect" / "sign in", send the link automatically
    sendOnce: true,
  },
});

const STYLE =
  "You are the assistant behind Configure, demoing the Configure x Photon partnership over iMessage. " +
  "You're a warm, genuinely helpful guide who is also low-key showing off Configure: it gives any agent " +
  "persistent memory and identity across every channel. Use your tools to look things up, to REMEMBER " +
  "anything new the user tells you about themselves, and — for signed-in users — to check their Google " +
  "Calendar, search their Gmail, send an email, or add a calendar event. Offer those when they'd help; if " +
  "an account isn't connected yet, offer to connect it instead of echoing an error. " +
  "Texting style: SHORT and human — at most two brief messages; if you send two, separate them with a line " +
  "that is only ---. Never send a wall of text, markdown, or emoji. If a group message clearly isn't for you, reply [SKIP].";

// Marker the model's `---` breaks map to, so we send them as separate texts (U+001E record separator).
const EXPLICIT_MESSAGE_SPLIT = String.fromCharCode(30); // U+001E record separator, maps `---` breaks to separate texts

// The developer owns the loop. configureSpectrum.handle() resolves who's texting,
// (optionally) sends the sign-in link, then runs our handler with their profile.
for await (const [space, message] of app.messages) {
  // A single failed turn must never crash the whole agent — catch, log, keep looping.
  try {
  await configureSpectrum.handle(space, message, async (ctx) => {
    if (!ctx.text) return;

    const { profile } = await ctx.profile.read();
    const signedInReturn = ctx.linked && isSignInReturnText(ctx.text);

    const base = profileHasData(profile)
      ? `${STYLE}\n\nWhat Configure already remembers about this user:\n${JSON.stringify(profile, null, 2)}`
      : `${STYLE}\n\nYou don't have a profile for them yet. When they ask who they are or how this works, ` +
        `invite them to load it by tapping this link (send it as its own message):\n${await ctx.signInUrl()}`;

    const system = [
      base,
      `Right now:\n${formatRuntimeContext(profile)}`,
      signedInReturn ? signedInReturnGoal(firstName(profile)) : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    // Signed-in users also get their connected-account tools: search Gmail, read the
    // calendar, send an email, create an event. Anonymous users get read/remember only.
    const tools = (ctx.linked
      ? ctx.profile.tools({
          connectors: ["gmail", "calendar"],
          actions: ["email.send", "calendar.create_event"],
        })
      : ctx.profile.tools()) as unknown as Anthropic.Tool[];

    const messages: Anthropic.MessageParam[] = [{ role: "user", content: ctx.text }];

    for (let hop = 0; hop < 4; hop += 1) {
      const reply = await claude.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 500,
        system,
        tools,
        messages,
      });
      messages.push({ role: "assistant", content: reply.content });

      const toolUses = reply.content.filter(
        (c): c is Anthropic.ToolUseBlock => c.type === "tool_use",
      );
      if (toolUses.length === 0) {
        const out = reply.content.map((c) => (c.type === "text" ? c.text : "")).join("").trim();
        if (!out || out === "[SKIP]") return;
        // Honor explicit --- breaks, then SMS-normalize + length-split into natural bursts.
        const bursts = splitForImessage(out.replace(/\n?---\n?/g, EXPLICIT_MESSAGE_SPLIT));
        for (let i = 0; i < bursts.length; i += 1) {
          if (i > 0) await sleep(900 + Math.floor(Math.random() * 2100));
          await message.reply(bursts[i]);
        }
        return;
      }

      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolUses.map(async (call) => ({
          type: "tool_result" as const,
          tool_use_id: call.id,
          content: safeJson(await ctx.profile.executeTool({ name: call.name, arguments: asRecord(call.input) })),
        })),
      );
      messages.push({ role: "user", content: toolResults });
    }
  });
  } catch (error) {
    console.error("[agent] turn failed:", error instanceof Error ? error.message : error);
  }
}

// --- iMessage-native reply formatting (ported from Configure's production agent) ---

function stripMarkdown(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, (match) => match.replace(/```[a-z]*|```/gi, "").trim())
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1: $2")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/`([^`]+)`/g, "$1");
}

function stripLeakedLabel(value: string): string {
  let output = value.trim();
  for (let i = 0; i < 3; i += 1) {
    const previous = output;
    output = output
      .replace(/^[\s"'“”‘’`]*(?:configure|assistant|bot)\s*(?:(?:to|for|->|→)\s*)?[^:\n]{0,100}:\s*/i, "")
      .replace(/^\[(?:configure|assistant|bot)[^\]\n]{0,80}\]\s*/i, "")
      .trim();
    if (output === previous) break;
  }
  return output;
}

// Strip markdown, emoji, and em/en-dashes, drop any leaked "Configure:" label — keep it texty.
function trimForSms(value: string, max = 520): string {
  const cleaned = stripMarkdown(value.replace(/\r/g, "").replace(/\n\s*\n\s*\n+/g, "\n\n"))
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/,\s*([.!?])/g, "$1")
    .replace(/,\s*,+/g, ",")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const withoutLabel = stripLeakedLabel(cleaned);
  return withoutLabel.length <= max ? withoutLabel : withoutLabel.slice(0, max).trim();
}

// Split into natural, iMessage-sized bursts (honoring explicit breaks first), max 3.
function splitForImessage(value: string, max = 280): string[] {
  if (value.includes(EXPLICIT_MESSAGE_SPLIT)) {
    return value.split(EXPLICIT_MESSAGE_SPLIT).flatMap((part) => splitForImessage(part, max)).slice(0, 3);
  }
  const text = trimForSms(value);
  if (!text) return [];
  if (text.length <= max) return [text];

  const chunks: string[] = [];
  for (const paragraph of text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)) {
    if (paragraph.length <= max) {
      chunks.push(paragraph);
      continue;
    }
    const sentences = paragraph.match(/[^.!?\n]+[.!?]?/g) || [paragraph];
    let current = "";
    for (const raw of sentences) {
      const sentence = raw.trim();
      if (!sentence) continue;
      if (!current) current = sentence;
      else if (`${current} ${sentence}`.length <= max) current = `${current} ${sentence}`;
      else { chunks.push(current); current = sentence; }
      while (current.length > max) {
        const cutAt = current.lastIndexOf(" ", max);
        const index = cutAt > 80 ? cutAt : max;
        chunks.push(current.slice(0, index).trim());
        current = current.slice(index).trim();
      }
    }
    if (current) chunks.push(current);
  }
  return chunks.slice(0, 3);
}

// --- personalization context ---

function formatInTimeZone(date: Date, timeZone: string): string | null {
  try {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone,
      timeZoneName: "short",
    }).format(date);
  } catch {
    return null;
  }
}

// Give the model the user's local time/location, so "this morning" means THEIR morning.
function formatRuntimeContext(profile: unknown): string {
  const now = new Date();
  const lines = [`current time (UTC): ${now.toISOString()}`];
  const identity = isRecord(profile) && isRecord(profile.identity) ? profile.identity : {};
  const timezone = typeof identity.timezone === "string" ? identity.timezone : null;
  const location = typeof identity.location === "string" ? identity.location : null;
  if (timezone) {
    const local = formatInTimeZone(now, timezone);
    lines.push(`their timezone: ${timezone}`);
    if (local) lines.push(`their local time: ${local}`);
  }
  if (location) lines.push(`their location: ${location}`);
  return lines.join("\n");
}

// "done" / "signed in" right after we sent a link → treat as a fresh sign-in return.
function isSignInReturnText(text: string): boolean {
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s']/g, " ").replace(/\s+/g, " ").trim();
  return /^(done|all done|i'?m done|signed in|i signed in|done signed in)$/.test(normalized);
}

function signedInReturnGoal(name: string | null): string {
  return [
    "Turn goal: signed-in return. The user just came back from signing in.",
    name ? `Open by addressing them by first name: ${name}.` : "If you know their name, open with it.",
    "Make this the first personalized moment: warm, exactly one concrete detail from their profile, then stop.",
    "Do not mention profiles loading, connected tools, or sign-in unless they ask.",
  ].join("\n");
}

// --- small helpers ---

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function firstName(profile: unknown): string | null {
  if (!isRecord(profile) || !isRecord(profile.identity)) return null;
  const value = profile.identity.name;
  const name = typeof value === "string" ? value.trim() : "";
  return name ? name.split(/\s+/)[0] || null : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function profileHasData(profile: unknown): boolean {
  if (!isRecord(profile) || !isRecord(profile.identity)) return false;
  return Object.values(profile.identity).some((v) => v != null && v !== "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
