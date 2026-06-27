FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY server.js ./
RUN mkdir -p /app/data

EXPOSE 3001

ENV PORT=3001

CMD ["node", "server.js"]
