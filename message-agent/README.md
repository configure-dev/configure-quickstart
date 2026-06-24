# Message agent — Configure on Photon / Spectrum

An iMessage / SMS agent that **recognizes the user silently by phone** and sends a single hosted link when they want to connect. The whole loop is in [`agent.ts`](./agent.ts).

## Run it

```bash
cp .env.example .env     # Configure keys + Photon project keys
npm install
npm run dev
```

You’ll need a [Photon](https://app.photon.codes) project (for the iMessage line) and Configure keys.

## The flow (what `agent.ts` does)

On every inbound message:

1. **Recognize** — `configure.auth.resolveMessageIdentity({ externalId, token, phoneCandidates })` returns the user. If they’ve signed in before, they’re matched by phone with **zero friction**; otherwise you get a stable `externalId` to use until they link.
2. **Connect** — when the message says “connect”, `configure.auth.signInUrl({ delivery: "message" })` builds the hosted link and the agent texts it. Configure handles phone + consent.
3. **Personalize** — `configure.profile(identity).read()` returns the profile, so the agent can greet the user by name and reason over their connected accounts.

This is the same primitive as the [web example](../web) — only the **delivery** differs (a text instead of a redirect). That’s why Configure is channel-agnostic.
