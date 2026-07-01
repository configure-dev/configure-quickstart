import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { Spectrum } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";
import { inMemoryStore, withConfigure } from "@configure-ai/spectrum-ts";

// Spectrum carries messages, Configure resolves user context, and your model generates replies.
const model = new Anthropic({ apiKey: requireEnv("MODEL_API_KEY") });
const modelName = requireEnv("MODEL_NAME");

const app = await Spectrum({
  projectId: process.env.PHOTON_PROJECT_ID!,
  projectSecret: process.env.PHOTON_PROJECT_SECRET!,
  providers: [imessage.config()],
});

const configureSpectrum = withConfigure({
  apiKey: process.env.CONFIGURE_API_KEY!,
  publishableKey: process.env.CONFIGURE_PUBLISHABLE_KEY!,
  agent: process.env.CONFIGURE_AGENT!,
  store: inMemoryStore(),
  signIn: {
    displayName: "Configure",
    agentPhone: process.env.AGENT_PHONE_NUMBER,
  },
  connect: {
    mode: "intent",
    sendOnce: true,
    behavior: "send-and-stop",
    message: "Connect your Configure profile: {url}",
  },
});

const STYLE =
  "You are the assistant behind Configure, demoing the Configure x Photon partnership over iMessage. " +
  "You're a warm, genuinely helpful guide who is also low-key showing off Configure: it gives any agent " +
  "persistent memory and identity across every channel. Use your tools to look things up, and to REMEMBER " +
  "anything new the user tells you about themselves (their name, preferences, what they're working on). " +
  "Texting style: SHORT and human — at most two brief messages; if you send two, separate them with a line " +
  "that is only ---. Never send a wall of text. If a group message clearly isn't for you, reply [SKIP].";

for await (const [space, message] of app.messages) {
  await configureSpectrum.handle(space, message, async (ctx) => {
    if (!ctx.text) return;

    const { profile } = await ctx.profile.read();
    const system = profileHasData(profile)
      ? `${STYLE}\n\nWhat Configure already remembers about this user:\n${JSON.stringify(profile, null, 2)}`
      : `${STYLE}\n\nNo approved Configure profile is available for this sender yet. Do not claim personal context that is not present in the current conversation or tool results.`;

    // Give the model Configure's read / search / remember tools, and run the tool loop.
    const tools = ctx.profile.tools() as unknown as Anthropic.Tool[];
    const messages: Anthropic.MessageParam[] = [{ role: "user", content: ctx.text }];

    for (let hop = 0; hop < 4; hop += 1) {
      const reply = await model.messages.create({
        model: modelName,
        max_tokens: 500,
        system,
        tools,
        messages,
      });
      messages.push({ role: "assistant", content: reply.content });

      const toolUses = reply.content.filter((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");
      if (toolUses.length === 0) {
        const out = reply.content.map((c) => (c.type === "text" ? c.text : "")).join("").trim();
        if (!out || out === "[SKIP]") return;
        const bursts = out.split(/\n?---\n?/).map((s) => s.trim()).filter(Boolean).slice(0, 2);
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
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}. Copy .env.example to .env and fill it in.`);
  return value;
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
