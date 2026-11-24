# --- Сборка фронтенда ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY client ./client
RUN npm run build

# --- Production-образ ---
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server ./server
COPY --from=build /app/client/dist ./client/dist
RUN mkdir -p /app/data
EXPOSE 4000
CMD ["node", "server/index.js"]
