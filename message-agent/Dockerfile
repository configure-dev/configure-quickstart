FROM node:22-slim

WORKDIR /app

# Install deps. spectrum-ts pulls better-sqlite3 (prebuilt binaries via prebuild-install).
# Adapter vendored as a tarball for now (not on npm yet); the public quickstart uses the npm dep.
COPY package.json configure-ai-spectrum-ts-0.1.0-preview.0.tgz ./
RUN npm install --no-audit --no-fund

# App source.
COPY tsconfig.json agent.ts ./

# Worker: connects out to Photon and listens. No inbound HTTP port.
CMD ["npm", "start"]
