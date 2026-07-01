FROM node:22-slim

WORKDIR /app

# Install deps. spectrum-ts pulls better-sqlite3 (prebuilt binaries via prebuild-install).
# The Configure adapter is a vendored preview tarball (a file: dep in package.json),
# so the vendor/ dir must be present before npm install.
COPY package.json ./
COPY vendor ./vendor
RUN npm install --no-audit --no-fund

# App source.
COPY tsconfig.json agent.ts ./

# Worker: connects out to Photon and listens. No inbound HTTP port.
CMD ["npm", "start"]
