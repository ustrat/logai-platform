FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev --ignore-scripts

COPY tsconfig.json ./
COPY src ./src

RUN npm install -g tsx

EXPOSE 4000

CMD ["tsx", "src/index.ts"]