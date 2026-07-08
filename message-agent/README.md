# Configure for Spectrum Message Agents

This example is a Spectrum message agent for iMessage/SMS. It keeps the normal Spectrum message loop and adds Configure identity, consent, profile context, and memory tools with `withConfigure`.

## Run it

```bash
cp .env.example .env     # Configure keys + Photon project keys
npm install
npm run dev
```

You'll need a [Photon](https://app.photon.codes) project for the iMessage line, Configure keys, and model provider credentials for the sample handler.

## The flow

On every inbound message, `withConfigure`:

1. **Resolves identity** from a stored token, phone-backed sender evidence, or a stable developer-scoped fallback.
2. **Sends sign-in links outside the model path** when the user asks to connect. Configure handles verification and consent, then the adapter stops the turn before the model runs.
3. **Provides profile runtime** through `ctx.profile`, including read, search, remember, and tool execution.

The handler gives its model Configure profile tools plus the connector/action capabilities this hosted surface supports, so the agent can read, search, remember, use connected context, and perform approved writes before replying. Use `configure_profile_read` and `configure_profile_search` for overview, concrete memories, imported-source questions, and details that need exact source attribution. Host-side `ctx.profile.read({ sections })` plus `profile.format()` is available for app-owned UI, inspection, or explicit context slots, but it is not required for the normal model loop. After a read-backed reply, the sample calls `ctx.profile.commit()` with bounded user/assistant turn evidence.

Action tools, such as sending email or creating calendar events, change external state. Expose them when the hosted/product surface requested those capabilities and the app supports them. Tool visibility means the app supports the capability; `ctx.profile.executeTool()` still enforces linked state, connector state, permissions, scopes, approval, and reconnect recovery. If a connector or action is unavailable, send the hosted connect, reconnect, permissions, or approval link.

The model does not generate Configure sign-in URLs; `withConfigure` handles that as runtime policy. If a Configure-backed connector later needs repair, application code can send a targeted hosted reconnect link with `ctx.replyWithReconnect({ connectors: ["gmail"] })` instead of teaching the model a URL format. The sample uses one model SDK, but the Configure and Spectrum integration does not depend on any specific model provider.

For iMessage, the adapter uses Spectrum's routed `space.phone` as the current return line when it is a valid E.164 phone number. Only add `signIn.agentPhone` for an explicit app-bound line or a deterministic fallback when your app can prove which active line should receive the returning user.

The sample also attaches `onEvent` to show where production agents should emit their own privacy-safe journey telemetry. Keep those events redacted: log states, counts, modes, and reason codes, not raw phone numbers, tokens, URLs, message bodies, connector payloads, or profile facts.

The sample uses `withConfigure.localStore()` for process-local adapter state while running locally. When deploying, back the store with the persistence your app already uses for server-side state: sender mappings, approved Configure tokens, sign-in delivery state, and webhook idempotency.

Spectrum owns messaging, providers, webhooks, and delivery. Configure owns identity, consent, profile runtime, and memory access. The adapter joins those systems at the message boundary.

## E2E checklist

Use this checklist for the managed hosted-link flow:

1. Fill `.env` with real Configure keys, `CONFIGURE_AGENT`, Photon project credentials, and model credentials.
2. Start the worker with `npm run dev`.
3. Text the Photon/iMessage line with a connect intent such as `connect my profile`.
4. Confirm the adapter replies with a hosted `https://sign-in.me/{agent}` link and the model does not send a second response for that turn. On iMessage dedicated-line spaces, the link may include message return metadata such as `delivery=message` and `message_line_phone`.
5. Complete the hosted Configure sign-in/approval flow in the browser.
6. Text the same line again.
7. Confirm the sender is recognized as linked, the handler runs, and the model can call Configure tools for profile context.
8. Confirm no federated or cross-agent profile context is included before `ctx.linked` is true. Developer-scoped unlinked context may exist if the same app already wrote it.

For this flow, step 7 depends on Spectrum exposing phone-backed sender evidence on the next inbound message, which iMessage/SMS-style channels should provide through sender metadata. If a channel only exposes a channel-local sender id, the adapter will continue with a developer-scoped unlinked profile until signed message sender proof is available for that channel.

The sample intentionally does not require Photon-signed message sender proof or magic-link support. `signIn.linkMode: "managed"` registers the current return line with Configure, routes link creation through Configure's message URL API, and still gets a public hosted `sign-in.me/{agent}` link when verification is unavailable. The handler does not change.
