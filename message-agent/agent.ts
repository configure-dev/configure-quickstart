import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { Spectrum } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";
import { personalize } from "configure/spectrum";

// Three pieces: Spectrum is the phone, Configure is the memory, Claude is the brain.
const claude = new Anthropic(); // reads ANTHROPIC_API_KEY

const app = await Spectrum({
  projectId: process.env.PHOTON_PROJECT_ID!,
  projectSecret: process.env.PHOTON_PROJECT_SECRET!,
  providers: [imessage.config()],
});

const STYLE =
  "You are the assistant behind Configure, demoing the Configure x Photon partnership over iMessage. " +
  "You're a warm, genuinely helpful guide who is also low-key showing off Configure: it gives any agent " +
  "persistent memory and identity across every channel. Use your tools to look things up, and to REMEMBER " +
  "anything new the user tells you about themselves (their name, preferences, what they're working on). " +
  "Texting style: SHORT and human — at most two brief messages; if you send two, separate them with a line " +
  "that is only ---. Never send a wall of text. If a group message clearly isn't for you, reply [SKIP].";

personalize(app, {
  apiKey: process.env.CONFIGURE_API_KEY!,
  publishableKey: process.env.CONFIGURE_PUBLISHABLE_KEY!,
  agent: process.env.CONFIGURE_AGENT!,
  agentPhone: process.env.AGENT_PHONE_NUMBER,
  displayName: "Configure",
  reply: async ({ text, profile, signInUrl, runtime }) => {
    const system = profileHasData(profile)
      ? `${STYLE}\n\nWhat Configure already remembers about this user:\n${JSON.stringify(profile, null, 2)}`
      : `${STYLE}\n\nYou don't have a profile for them yet. When they ask who they are or how this works, ` +
        `invite them to load it by tapping this link (send it as its own message):\n${signInUrl}`;

    // Give Claude Configure's read / search / remember tools, and run the tool loop.
    const tools = runtime.tools() as unknown as Anthropic.Tool[];
    const messages: Anthropic.MessageParam[] = [{ role: "user", content: text }];

    for (let hop = 0; hop < 4; hop += 1) {
      const message = await claude.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 500,
        system,
        tools,
        messages,
      });
      messages.push({ role: "assistant", content: message.content });

      const toolUses = message.content.filter((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");
      if (toolUses.length === 0) {
        const out = message.content.map((c) => (c.type === "text" ? c.text : "")).join("").trim();
        if (!out || out === "[SKIP]") return null;
        return out.split(/\n?---\n?/).map((s) => s.trim()).filter(Boolean).slice(0, 2);
      }

      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolUses.map(async (call) => ({
          type: "tool_result" as const,
          tool_use_id: call.id,
          content: safeJson(await runtime.executeTool({ name: call.name, arguments: asRecord(call.input) })),
        })),
      );
      messages.push({ role: "user", content: toolResults });
    }
    return null;
  },
});

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
