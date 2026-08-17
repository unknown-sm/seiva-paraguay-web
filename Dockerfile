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
COPY seiva-static/img/productos ./img-build
EXPOSE 3001
ENV PORT=3001
ENV NODE_ENV=production
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "require('http').get('http://localhost:3001/api/productos',r=>{process.exit(r.statusCode===200?0:1)})"
CMD ["node", "server.js"]
