# Staging demo API only — synthetic data. Not for real clinic LAN gateways.
FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps ./apps
COPY packages ./packages
COPY supabase ./supabase
COPY scripts ./scripts
COPY blueprints ./blueprints

RUN npm ci
RUN npm run build:gateway:deploy

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV APP_ENV=staging
ENV GATEWAY_HOST=0.0.0.0
ENV GATEWAY_LAN_DISCOVERY=false

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/gateway ./apps/gateway
COPY --from=build /app/packages ./packages

EXPOSE 8787

CMD ["npm", "run", "start", "--workspace", "@klickit/gateway"]
