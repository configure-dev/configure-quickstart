# Message Agent — Configure for Spectrum

An iMessage / SMS agent built on Photon Spectrum. The example keeps the normal Spectrum message loop and adds Configure identity, consent, profile context, and memory tools with `withConfigure`.

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

The handler then gives its model Configure tools, so the agent can read and remember user context before replying. The model does not generate Configure sign-in URLs; `withConfigure` handles that as runtime policy. The sample uses one model SDK, but the Configure and Spectrum integration does not depend on any specific model provider.

Spectrum owns messaging and delivery. Configure owns identity, consent, profile runtime, and memory.

## E2E checklist

Use this checklist before wiring the minted URL API:

1. Fill `.env` with real Configure keys, `CONFIGURE_AGENT`, Photon project credentials, `AGENT_PHONE_NUMBER`, and model credentials.
2. Start the worker with `npm run dev`.
3. Text the Photon/iMessage line with a connect intent such as `connect my profile`.
4. Confirm the adapter replies with a clean `https://sign-in.me/{agent}` link and the model does not send a second response for that turn.
5. Complete the hosted Configure sign-in/approval flow in the browser.
6. Text the same line again.
7. Confirm the sender is recognized as linked, the handler runs, and the model receives Configure profile context.
8. Confirm no federated or cross-agent profile context is included before `ctx.linked` is true. Developer-scoped unlinked context may exist if the same app already wrote it.

The current flow intentionally does not require Photon signed-token or magic-link support. The next implementation can replace the plain link provider with Jon's minting API without changing the handler.
