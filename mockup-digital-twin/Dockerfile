FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY src/ ./src/

EXPOSE 3001

CMD ["npx", "ts-node", "src/server.ts"]
