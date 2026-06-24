# Security Policy

## Reporting a vulnerability

Email **security@configure.dev** with details and steps to reproduce. We aim to acknowledge within two business days. Please do not open public issues for security reports.

## Key handling

- **Secret keys (`sk_…`) are server-side only.** Never commit them, log them, or expose them in client-side code.
- **Publishable keys (`pk_…`) are browser-safe** — they only build the hosted sign-in link.
- `.env` files in this repo are gitignored. Never commit real credentials.

## In these examples

- The secret key stays on the server; the browser only ever sees the publishable key and a one-time code.
- The web example uses a one-time `state` value (httpOnly cookie) to protect the OAuth callback against CSRF.
