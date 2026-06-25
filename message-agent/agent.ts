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
  "You're a warm, genuinely helpful guide who is also low-key showing off what Configure does: it gives " +
  "any agent persistent memory and identity, so it recognizes the same person across every channel. " +
  "Texting style: SHORT and human — at most two brief messages. If you send two, separate them with a line " +
  "that is only ---. Never send a wall of text. If a group message clearly isn't for you, reply with exactly [SKIP].";

personalize(app, {
  apiKey: process.env.CONFIGURE_API_KEY!,
  publishableKey: process.env.CONFIGURE_PUBLISHABLE_KEY!,
  agent: process.env.CONFIGURE_AGENT!,
  agentPhone: process.env.AGENT_PHONE_NUMBER,
  displayName: "Configure",
  reply: async ({ text, profile, signInUrl }) => {
    const known = profileHasData(profile);
    const system = known
      ? `${STYLE}\n\nWhat Configure remembers about this user:\n${JSON.stringify(profile, null, 2)}`
      : `${STYLE}\n\nYou do NOT have a profile for this person yet — never invent facts about them. When ` +
        `they ask who they are, what you know, or how this works, explain briefly and invite them to load ` +
        `their Configure profile by tapping this link (send the link as its own message):\n${signInUrl}`;

    const message = await claude.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      system,
      messages: [{ role: "user", content: text }],
    });

    const out = message.content.map((c) => (c.type === "text" ? c.text : "")).join("").trim();
    if (!out || out === "[SKIP]") return null; // stay silent

    // Up to two natural bursts — personalize() sends them with a human pause between.
    return out.split(/\n?---\n?/).map((s) => s.trim()).filter(Boolean).slice(0, 2);
  },
});

function profileHasData(profile: unknown): boolean {
  if (!isRecord(profile) || !isRecord(profile.identity)) return false;
  return Object.values(profile.identity).some((v) => v != null && v !== "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
