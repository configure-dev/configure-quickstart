# Configure for Spectrum Message Agents

This example is a Spectrum message agent for iMessage/SMS. It keeps the normal Spectrum message loop and adds Configure identity, consent, profile context, and memory tools with `withConfigure`.

Until `@configure-ai/spectrum-ts` is published to npm, this example installs the packed preview tarball from [`vendor/`](./vendor/).

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

The handler gives its model Configure tools, so the agent can read and remember user context before replying. The model does not generate Configure sign-in URLs; `withConfigure` handles that as runtime policy. If a Configure-backed connector later needs repair, application code can send a targeted hosted reconnect link with `ctx.replyWithReconnect({ connectors: ["gmail"] })` instead of teaching the model a URL format. The sample uses one model SDK, but the Configure and Spectrum integration does not depend on any specific model provider.

The sample uses `withConfigure.localStore()` for process-local adapter state while running locally. When deploying, back the store with the persistence your app already uses for server-side state: sender mappings, approved Configure tokens, sign-in delivery state, and webhook idempotency.

Spectrum owns messaging, providers, webhooks, and delivery. Configure owns identity, consent, profile runtime, and memory access. The adapter joins those systems at the message boundary.

## E2E checklist

Use this checklist for the current plain-link flow:

1. Fill `.env` with real Configure keys, `CONFIGURE_AGENT`, Photon project credentials, `AGENT_PHONE_NUMBER`, and model credentials.
2. Start the worker with `npm run dev`.
3. Text the Photon/iMessage line with a connect intent such as `connect my profile`.
4. Confirm the adapter replies with a clean `https://sign-in.me/{agent}` link and the model does not send a second response for that turn.
5. Complete the hosted Configure sign-in/approval flow in the browser.
6. Text the same line again.
7. Confirm the sender is recognized as linked, the handler runs, and the model receives Configure profile context.
8. Confirm no federated or cross-agent profile context is included before `ctx.linked` is true. Developer-scoped unlinked context may exist if the same app already wrote it.

For the current plain-link flow, step 7 depends on Spectrum exposing phone-backed sender evidence on the next inbound message, which iMessage/SMS-style channels should provide through sender metadata. If a channel only exposes a channel-local sender id, the adapter will continue with a developer-scoped unlinked profile until signed subject-token support is available for that channel.

The sample intentionally does not require Photon signed-token or magic-link support. When signed subject evidence is available, set `signIn.linkMode` to `"auto"` so the adapter can ask Configure for a message-bound URL; if verification is unavailable, it keeps sending the plain `sign-in.me/{agent}` link. The handler does not change.
