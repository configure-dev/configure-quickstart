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
