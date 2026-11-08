# Build stage
FROM node:24.22.1-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# Production stage
FROM node:24.22.1-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node src/ ./src/
RUN chown -R node:node /app
USER node
EXPOSE 3000
CMD ["node", "src/index.js"]
