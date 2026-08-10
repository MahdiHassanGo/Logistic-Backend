FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm install --ignore-scripts

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run prisma:generate && npm run build

FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S nodejs && adduser -S app -G nodejs
COPY package*.json ./
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
RUN npm prune --omit=dev --ignore-scripts
USER app
EXPOSE 4000
CMD ["node", "dist/src/server.js"]
