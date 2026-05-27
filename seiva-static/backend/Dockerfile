FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY server.js ./
RUN mkdir -p /app/data

EXPOSE 3001

ENV PORT=3001
ENV JWT_SECRET=SeivaAdmin2026!
ENV ADMIN_PASSWORD=SeivaAdmin2026!

CMD ["node", "server.js"]
