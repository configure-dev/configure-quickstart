# Contributing

This repo holds runnable examples for integrating [Configure](https://configure.dev). Each folder — [`web/`](./web) and [`message-agent/`](./message-agent) — is a standalone example.

## Run an example

```bash
cd web            # or message-agent
cp .env.example .env     # add your keys — `npx configure setup` writes them
npm install
npm run dev
```

## Pull requests

- Keep examples **minimal and copy-pasteable** — they are teaching tools, not production apps.
- Run `npm run typecheck` in the example you touched before opening a PR.
- Match the existing style and Configure's docs voice. Reference: https://docs.configure.dev.

## Questions

Open an issue, or see the docs at [docs.configure.dev](https://docs.configure.dev).
