import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { Spectrum } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";
import { withConfigure } from "configure-spectrum";

// Spectrum carries messages, Configure resolves user context, and your model generates replies.
const model = new Anthropic({ apiKey: requireEnv("MODEL_API_KEY") });
const modelName = requireEnv("MODEL_NAME");
const CONFIGURE_CONNECTORS = ["gmail", "calendar"] as ["gmail", "calendar"];
const CONFIGURE_ACTIONS = ["email.send", "calendar.create_event"] as ["email.send", "calendar.create_event"];

const app = await Spectrum({
  projectId: process.env.PHOTON_PROJECT_ID!,
  projectSecret: process.env.PHOTON_PROJECT_SECRET!,
  providers: [imessage.config()],
});

const configureSpectrumOptions = {
  apiKey: process.env.CONFIGURE_API_KEY!,
  publishableKey: process.env.CONFIGURE_PUBLISHABLE_KEY!,
  agent: process.env.CONFIGURE_AGENT!,
  store: withConfigure.localStore(),
  signIn: {
    displayName: "Configure",
    linkMode: "managed" as const,
    connectors: CONFIGURE_CONNECTORS,
  },
  connect: {
    mode: "intent" as const,
    sendOnce: true,
    behavior: "send-and-stop" as const,
    message: "Connect your Configure profile: {url}",
  },
  onEvent: logConfigureEvent,
};
const configureSpectrum = withConfigure(configureSpectrumOptions);

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

    let configureReadUsed = false;
    const system = `${STYLE}\n\nUse Configure tools when profile context, memories, connected data, or durable memory writes would help. Do not claim personal context that is not present in the current conversation or tool results.`;

    // Give the model the Configure capabilities this hosted surface supports. Visibility is not
    // authorization: ctx.profile.executeTool enforces linked state, connector state, permissions,
    // scopes, approval, and recovery.
    const tools = ctx.profile.tools({
      connectors: CONFIGURE_CONNECTORS,
      actions: CONFIGURE_ACTIONS,
    }) as unknown as Anthropic.Tool[];
    const messages: Anthropic.MessageParam[] = [{ role: "user", content: ctx.text }];
    let finalResponse = "";

    try {
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
          finalResponse = out;
          const bursts = out.split(/\n?---\n?/).map((s) => s.trim()).filter(Boolean).slice(0, 2);
          for (let i = 0; i < bursts.length; i += 1) {
            if (i > 0) await sleep(900 + Math.floor(Math.random() * 2100));
            await message.reply(bursts[i]);
          }
          return;
        }

        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const call of toolUses) {
          const content = await executeConfigureTool(ctx, call);
          if (isReadBackedConfigureTool(call.name) && !isConfigureFailure(content)) {
            configureReadUsed = true;
          }
          toolResults.push({
            type: "tool_result" as const,
            tool_use_id: call.id,
            content,
          });
        }
        messages.push({ role: "user", content: toolResults });
      }
    } catch (error) {
      if (error instanceof ConfigureRecoverySent) return;
      throw error;
    } finally {
      if (finalResponse && configureReadUsed) {
        ctx.profile.commit({
          messages: [
            { role: "user", content: ctx.text },
            { role: "assistant", content: finalResponse },
          ],
        }).catch((error) => {
          console.warn("[configure] profile commit failed", { error: error instanceof Error ? error.name : "unknown" });
        });
      }
    }
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class ConfigureRecoverySent extends Error {
  constructor() {
    super("Configure recovery link sent");
  }
}

type ConfigureToolRuntime = {
  profile: {
    executeTool(toolCall: { name: string; arguments?: Record<string, unknown> }): Promise<unknown>;
  };
  replyWithSignIn(): Promise<void>;
  replyWithReconnect(options?: { connectors?: string[]; message?: string }): Promise<void>;
};

type ConfigureToolFailure = {
  error: "configure_tool_failed";
  tool: string;
  message: string;
  code?: string;
  type?: string;
  suggestedAction?: string;
  requestId?: string;
  retryable?: boolean;
  connector?: string;
  recovery?: "signin" | "reconnect" | "permissions";
};

async function executeConfigureTool(ctx: ConfigureToolRuntime, call: Anthropic.ToolUseBlock): Promise<string> {
  try {
    const result = await ctx.profile.executeTool({ name: call.name, arguments: asRecord(call.input) });
    return safeJson(result);
  } catch (error) {
    const failure = configureToolFailure(call.name, error);
    if (failure.recovery === "signin") {
      await ctx.replyWithSignIn();
      throw new ConfigureRecoverySent();
    }
    if (failure.recovery === "reconnect" && failure.connector) {
      await ctx.replyWithReconnect({
        connectors: [failure.connector],
        message: `Connect ${connectorLabel(failure.connector)} to continue: {url}`,
      });
      throw new ConfigureRecoverySent();
    }
    if (failure.recovery === "permissions" && failure.connector) {
      await ctx.replyWithReconnect({
        connectors: [failure.connector],
        message: `Review ${connectorLabel(failure.connector)} permissions to continue: {url}`,
      });
      throw new ConfigureRecoverySent();
    }
    return safeJson(failure);
  }
}

function isReadBackedConfigureTool(name: string): boolean {
  return name === "configure_profile_read" || name === "configure_profile_search";
}

function isConfigureFailure(content: string): boolean {
  try {
    const parsed = JSON.parse(content);
    return isRecord(parsed) && parsed.error === "configure_tool_failed";
  } catch {
    return false;
  }
}

function configureToolFailure(tool: string, error: unknown): ConfigureToolFailure {
  const code = stringProp(error, "code");
  const suggestedAction = stringProp(error, "suggestedAction");
  const connector = connectorForTool(tool);
  const failure: ConfigureToolFailure = {
    error: "configure_tool_failed",
    tool,
    message: error instanceof Error ? error.message : "Configure tool failed",
    ...(code ? { code } : {}),
    ...(stringProp(error, "type") ? { type: stringProp(error, "type") } : {}),
    ...(suggestedAction ? { suggestedAction } : {}),
    ...(stringProp(error, "requestId") ? { requestId: stringProp(error, "requestId") } : {}),
    ...(booleanProp(error, "retryable") !== undefined ? { retryable: booleanProp(error, "retryable") } : {}),
    ...(connector ? { connector } : {}),
  };
  if (code === "AUTH_REQUIRED") failure.recovery = "signin";
  if ((code === "TOOL_NOT_CONNECTED" || suggestedAction === "connect_tool") && connector) {
    failure.recovery = "reconnect";
  }
  if (suggestedAction === "check_permissions") failure.recovery = "permissions";
  return failure;
}

function connectorForTool(tool: string): string | undefined {
  if (tool.startsWith("configure_gmail_") || tool === "configure_email_send") return "gmail";
  if (tool.startsWith("configure_calendar_")) return "calendar";
  if (tool.startsWith("configure_drive_")) return "drive";
  if (tool.startsWith("configure_notion_")) return "notion";
  if (tool.startsWith("configure_sheets_")) return "sheets";
}

function connectorLabel(connector: string): string {
  const labels: Record<string, string> = {
    gmail: "Gmail",
    calendar: "Calendar",
    drive: "Drive",
    notion: "Notion",
    sheets: "Google Sheets",
  };
  return labels[connector] || connector;
}

type ConfigureEvent = {
  event?: string;
  channel?: string;
  identityState?: string;
  actionState?: string;
  outcome?: string;
  reason?: string;
  properties?: Record<string, unknown>;
};

const REDACTED_EVENT_KEY_RE = /(^|_)(phone|otp|token|receipt|email|message|query|prompt|preview|text|body|raw|secret|password|authorization|url|return_to|returnto|key)($|_)/i;
const SAFE_EVENT_KEYS = new Set([
  "connector_count",
  "fallback_reason",
  "link_mode",
  "message_url_mode",
  "return_line_present",
  "source",
  "message_sender_proof_present",
  "tool_count",
]);

function logConfigureEvent(event: ConfigureEvent): void {
  console.info("[configure] adapter event", {
    event: event.event,
    channel: event.channel,
    identityState: event.identityState,
    actionState: event.actionState,
    outcome: event.outcome,
    reason: event.reason,
    properties: sanitizeEventProperties(event.properties || {}),
  });
}

function sanitizeEventProperties(properties: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties)) {
    const normalizedKey = key.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`).toLowerCase();
    const safeAggregate = normalizedKey.startsWith("has_")
      || normalizedKey.endsWith("_count")
      || normalizedKey.endsWith("_present")
      || /(^|_)(duration_ms|elapsed_ms|latency_ms|attempt_count|status_code)$/.test(normalizedKey);
    if (!SAFE_EVENT_KEYS.has(normalizedKey) && !safeAggregate && REDACTED_EVENT_KEY_RE.test(normalizedKey)) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      safe[key] = value;
    } else if (Array.isArray(value)) {
      safe[key] = value.filter((item) => typeof item === "string").slice(0, 20);
    }
  }
  return safe;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringProp(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) return undefined;
  const candidate = value[key];
  return typeof candidate === "string" && candidate ? candidate : undefined;
}

function booleanProp(value: unknown, key: string): boolean | undefined {
  if (!isRecord(value)) return undefined;
  return typeof value[key] === "boolean" ? value[key] : undefined;
}
