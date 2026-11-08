# Build stage
FROM node:24.22.1-slim AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Production stage
FROM node:24.22.1-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi
COPY --from=builder --chown=node:node /app/dist ./dist
RUN chown -R node:node /app
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
