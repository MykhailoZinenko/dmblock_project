FROM node:22-slim

WORKDIR /app

# Copy workspace root
COPY package.json package-lock.json ./
COPY packages/game-core/package.json packages/game-core/
COPY server/package.json server/

RUN npm install --workspace=server --workspace=@arcana/game-core

# Copy source
COPY packages/game-core/src packages/game-core/src
COPY packages/game-core/tsconfig.json packages/game-core/
COPY server/src server/src
COPY server/tsconfig.json server/

EXPOSE 3001
CMD ["npx", "--workspace=server", "tsx", "src/index.ts"]
