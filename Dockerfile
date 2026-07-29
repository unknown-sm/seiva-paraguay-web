FROM node:22-alpine AS build-react
WORKDIR /react
COPY seivvaweb/app/package*.json ./
RUN npm ci
COPY seivvaweb/app/ ./
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY seiva-static/backend/package*.json ./
RUN npm ci --production
COPY seiva-static/backend/ ./
COPY --from=build-react /react/dist ./dist
COPY seiva-static/admin ./admin
COPY seiva-static/img ./img
EXPOSE 80
ENV PORT=80
ENV NODE_ENV=production
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -qO- http://localhost:80/api/productos || exit 1
CMD ["node", "server.js"]
