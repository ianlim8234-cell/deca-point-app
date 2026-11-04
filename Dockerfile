# Ema Rewards: one container that holds the API, the web app and the SQLite database
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data
COPY --from=build /app /app
VOLUME ["/data"]
EXPOSE 3000
CMD ["node", "--no-warnings", "server/index.js"]
