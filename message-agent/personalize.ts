import { Configure, type ConnectorName } from "configure";
import { text, Spectrum } from "spectrum-ts";

// personalize() is the entire Configure ↔ Spectrum integration behind one call.
// It wraps your agent's message loop: recognizes every texter by phone, sends a
// sign-in link in-thread when they ask to connect, reads their Configure profile,
// and hands you a clean reply context. You just write the reply. The secret key
// never leaves this server.
//
// This helper lives in the example to keep it transparent — it's a candidate to
// move into the `configure` SDK as a Spectrum adapter.

type SpectrumApp = Awaited<ReturnType<typeof Spectrum>>;

export interface PersonalizeOptions {
  /** Secret key (sk_). Server-side only. */
  apiKey: string;
  /** Publishable key (pk_). Safe to put in the sign-in link. */
  publishableKey: string;
  /** Your agent handle in Configure. */
  agent: string;
  /** Write the reply. You get the profile, the user's first name, and whether they're linked. */
  reply: (context: ReplyContext) => string | Promise<string>;
  /** Optional: the agent's iMessage line (E.164) for the sign-in "text back" button. */
  agentPhone?: string;
  /** Optional: agent display name shown on the hosted sign-in page. */
  displayName?: string;
  /** Optional: connectors to request at sign-in, e.g. ["gmail", "calendar"]. */
  connectors?: ConnectorName[];
  /** Optional: how to phrase the sign-in message. Default: "Connect your profile: <url>". */
  connectMessage?: (url: string) => string;
  /** Optional: words that trigger the sign-in link. Default: connect / link / sign in / login. */
  connectIntent?: RegExp;
}

export interface ReplyContext {
  /** The incoming message text. */
  text: string;
  /** The user's Configure profile (identity, preferences, memories, ...). */
  profile: unknown;
  /** Convenience: the user's first name, or null if unknown. */
  name: string | null;
  /** True once the user has signed in (linked); false while anonymous. */
  linked: boolean;
}

export function personalize(app: SpectrumApp, options: PersonalizeOptions): void {
  required(options.apiKey, "apiKey");
  required(options.publishableKey, "publishableKey");
  required(options.agent, "agent");

  const configure = new Configure({ apiKey: options.apiKey, agent: options.agent });
  const connectIntent = options.connectIntent ?? /\b(connect|link|sign[\s-]?in|login)\b/i;
  const connectMessage = options.connectMessage ?? ((url: string) => `Connect your profile: ${url}`);
  const store = new Map<string, { token: string; userId?: string }>();

  void (async () => {
    for await (const [space, message] of app.messages) {
      try {
        if (message.content.type !== "text") continue;

        const subjectKey = message.sender?.id ?? space.id;
        const saved = store.get(subjectKey);

        // Recognize the user every turn: a stored token, else silently by phone,
        // else a stable developer-scoped externalId until they sign in.
        const identity = await configure.auth.resolveMessageIdentity({
          externalId: `spectrum:${subjectKey}`,
          token: saved?.token,
          phoneCandidates: phoneCandidates(message.sender),
        });
        if (identity.token && identity.token !== saved?.token) {
          store.set(subjectKey, { token: identity.token, userId: identity.userId });
        }

        // Ask-to-connect → send the one hosted sign-in link, in-thread.
        if (!identity.linked && connectIntent.test(message.content.text)) {
          const url = configure.auth.signInUrl({
            publishableKey: options.publishableKey,
            delivery: "message",
            displayName: options.displayName,
            messageLinePhone: options.agentPhone,
            connectors: options.connectors,
          });
          await message.reply(text(connectMessage(url)));
          continue;
        }

        // Read the profile and hand it to your reply().
        const profile = await configure
          .profile(identity.token ? { token: identity.token } : { externalId: identity.externalId })
          .read();
        const body = await options.reply({
          text: message.content.text,
          profile,
          name: firstName(profile),
          linked: identity.linked,
        });
        await message.reply(text(body));
      } catch (error) {
        console.error("[personalize] turn failed:", error instanceof Error ? error.message : error);
      }
    }
  })();
}

// --- internal helpers: the parsing you shouldn't have to write yourself ---

function required(value: string, name: string): void {
  if (!value) throw new Error(`personalize: missing required option "${name}". Add it to your .env.`);
}

function phoneCandidates(sender: unknown): string[] {
  const address = stringField(sender, "address");
  if (!address || address.includes("@")) return [];
  const digits = address.replace(/[^\d]/g, "");
  return digits.length >= 8 ? [address] : [];
}

function firstName(profile: unknown): string | null {
  if (!isRecord(profile) || !isRecord(profile.identity)) return null;
  const name = profile.identity.name;
  return typeof name === "string" && name.trim() ? name.trim().split(/\s+/)[0] : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringField(value: unknown, field: string): string | undefined {
  if (!isRecord(value)) return undefined;
  const candidate = value[field];
  return typeof candidate === "string" ? candidate : undefined;
}
