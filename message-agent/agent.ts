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

// personalize() recognizes each texter by phone (works per-person in a group),
// hands you their profile, and gives you the sign-in link to offer. You write the
// reply — return null to stay silent when a group message isn't for you.
personalize(app, {
  apiKey: process.env.CONFIGURE_API_KEY!,
  publishableKey: process.env.CONFIGURE_PUBLISHABLE_KEY!,
  agent: process.env.CONFIGURE_AGENT!,
  agentPhone: process.env.AGENT_PHONE_NUMBER,
  displayName: "Configure",
  reply: async ({ text, profile, signInUrl }) => {
    const known = profileHasData(profile);

    const message = await claude.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      system:
        "You are Configure's assistant on iMessage — sometimes 1:1, sometimes in a group chat. " +
        "Reply in one or two short, texty sentences. If a message clearly isn't for you (people " +
        "chatting among themselves, no question, not addressed to you), reply with exactly [SKIP] " +
        "and nothing else.\n\n" +
        (known
          ? `What Configure knows about this user:\n${JSON.stringify(profile, null, 2)}`
          : "You do NOT have a profile for this person yet — never invent facts about them. If they " +
            "ask who they are, what you know, or to connect/sign in, invite them to load their " +
            `Configure profile by tapping this link:\n${signInUrl}`),
      messages: [{ role: "user", content: text }],
    });

    const out = message.content.map((c) => (c.type === "text" ? c.text : "")).join("").trim();
    if (!out || out === "[SKIP]") return null; // stay silent

    // Natural pause so it reads like a person, not an instant bot.
    await new Promise((resolve) => setTimeout(resolve, 1200 + Math.random() * 1800));
    return out;
  },
});

function profileHasData(profile: unknown): boolean {
  if (!isRecord(profile) || !isRecord(profile.identity)) return false;
  return Object.values(profile.identity).some((v) => v != null && v !== "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
