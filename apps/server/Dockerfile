FROM node:20-bookworm-slim

WORKDIR /app

RUN corepack enable

COPY . .

RUN pnpm install --frozen-lockfile=false
RUN pnpm build

EXPOSE 8787

CMD ["pnpm", "--filter", "@revogrid-mcp/server", "start"]
