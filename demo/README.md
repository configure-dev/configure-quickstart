# Configure demo — hosting

The demo is a single static page (`web/public/demo.html`) plus brand assets and
`web/public/logos/`. It loads GSAP from a CDN, so there is **no build and no SDK**
— any static host works.

## Deploy to Fly (matches the rest of Configure's infra)

From the repo root:

```bash
fly apps create configure-demo            # one time
fly deploy --config demo/fly.toml --dockerfile demo/Dockerfile
```

That serves the demo at `https://configure-demo.fly.dev` (and `/demo`).

### Point it at our URL

```bash
fly certs add demo.configure.dev --config demo/fly.toml
```

Then add a `CNAME demo → configure-demo.fly.dev` (or rely on the `*.configure.dev`
wildcard already on Fly). Result: **`https://demo.configure.dev`**.

## The URL is reusable

Both `/` and `/demo` render the demo, and it reads a source flag so the end
screen sends people back where they came from:

- `https://demo.configure.dev/?source=github` → "← Back to the repo"
- `https://demo.configure.dev/?return_to=https://app.example.com` → "← Back to app.example.com"
- `https://demo.configure.dev` → plain "Done"

## Simplest alternative (no Fly)

The repo is public, so GitHub Pages can serve it with zero infra:
enable Pages on `configure-dev/configure-quickstart`, then
`https://configure-dev.github.io/configure-quickstart/web/public/demo.html`
(custom domain `demo.configure.dev` via a CNAME).
