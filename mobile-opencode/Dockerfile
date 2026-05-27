FROM node:20-slim

RUN apt-get update && apt-get install -y \
    curl \
    git \
    openssh-client \
    python3 \
    make \
    g++ \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://opencode.ai/install | bash

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
