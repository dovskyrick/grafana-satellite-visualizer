FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY src/ ./src/

EXPOSE 3001

CMD ["node", "--max-old-space-size=400", "-r", "ts-node/register", "src/server.ts"]
