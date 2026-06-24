import "dotenv/config";
import { Configure } from "configure";
import { Spectrum, text } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";

// The secret key (sk_) stays server-side. The agent only ever sends a link.
const configure = new Configure({
  apiKey: requireEnv("CONFIGURE_API_KEY"),
  agent: requireEnv("CONFIGURE_AGENT"),
});

const app = await Spectrum({
  projectId: requireEnv("PHOTON_PROJECT_ID"),
  projectSecret: requireEnv("PHOTON_PROJECT_SECRET"),
  providers: [imessage.config()],
});

// Per-user token store. In-memory is fine for a demo; use Redis/Postgres in prod.
const store = new Map<string, { token: string; userId?: string }>();
const wantsConnect = /\b(connect|link|sign[\s-]?in|login)\b/i;

for await (const [space, message] of app.messages) {
  if (message.content.type !== "text") continue;

  const subjectKey = message.sender?.id ?? space.id;
  const saved = store.get(subjectKey);

  // Recognize the user every turn: a stored token, else silently by phone,
  // else a stable developer-scoped externalId until they sign in.
  const identity = await configure.auth.resolveMessageIdentity({
    externalId: `spectrum:${subjectKey}`,
    token: saved?.token,
    phoneCandidates: [phoneCandidateFromSender(message.sender)].filter(isNonEmpty),
  });
  if (identity.token && identity.token !== saved?.token) {
    store.set(subjectKey, { token: identity.token, userId: identity.userId });
  }

  // When they ask to connect, send the one hosted sign-in link.
  if (wantsConnect.test(message.content.text)) {
    const url = configure.auth.signInUrl({
      publishableKey: requireEnv("CONFIGURE_PUBLISHABLE_KEY"),
      delivery: "message",
      displayName: "Your Agent",
      messageLinePhone: process.env.AGENT_PHONE_NUMBER,
      connectors: ["gmail", "calendar"],
    });
    await message.reply(text(`Connect your profile: ${url}`));
    continue;
  }

  // Personalize. A linked user resolves by token; everyone else by externalId.
  const profile = await configure
    .profile(identity.token ? { token: identity.token } : { externalId: identity.externalId })
    .read();
  const name = firstName(profile);
  await message.reply(text(name ? `hey ${name}, what's up?` : "hey, what's up?"));
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}. Copy .env.example to .env and fill it in.`);
  return value;
}

function isNonEmpty(value: string | undefined | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function phoneCandidateFromSender(sender: unknown): string | undefined {
  const address = stringField(sender, "address");
  if (!address || address.includes("@")) return undefined;

  const digits = address.replace(/[^\d]/g, "");
  return digits.length >= 8 ? address : undefined;
}

function stringField(value: unknown, field: string): string | undefined {
  if (!isRecord(value)) return undefined;
  const candidate = value[field];
  return typeof candidate === "string" ? candidate : undefined;
}

function firstName(profile: unknown): string | null {
  if (!isRecord(profile) || !isRecord(profile.identity)) return null;
  const name = profile.identity.name;
  return typeof name === "string" && name.trim() ? name.trim().split(/\s+/)[0] : null;
}
