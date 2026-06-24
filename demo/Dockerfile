# Static host for the Configure demo (demo.html + /logos + brand assets).
# No SDK, no build step — it's a pure static page that loads GSAP from a CDN.
# Build context is the repo root:
#   fly deploy --config demo/fly.toml --dockerfile demo/Dockerfile
FROM nginx:1.27-alpine
COPY web/public /usr/share/nginx/html
COPY demo/nginx.conf /etc/nginx/conf.d/default.conf
