FROM node:22-alpine AS crypto-build

WORKDIR /app/packages/crypto
COPY packages/crypto/package.json packages/crypto/package-lock.json ./
RUN npm ci
COPY packages/crypto/tsconfig.json ./
COPY packages/crypto/src ./src
RUN npm run build

FROM node:22-alpine AS generator-build

WORKDIR /app/packages/password-generator
COPY packages/password-generator/package.json packages/password-generator/package-lock.json ./
RUN npm ci
COPY packages/password-generator/tsconfig.json ./
COPY packages/password-generator/src ./src
RUN npm run build

FROM node:22-alpine AS web-build

WORKDIR /app
COPY --from=crypto-build /app/packages/crypto ./packages/crypto
COPY --from=generator-build /app/packages/password-generator ./packages/password-generator
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/index.html frontend/tsconfig.json frontend/vite.config.ts ./
COPY frontend/public ./public
COPY frontend/src ./src
RUN npm run build

FROM nginx:1.29-alpine AS runtime

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web-build /app/frontend/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=3s --retries=5 --start-period=5s \
  CMD wget --quiet --output-document=- http://localhost/healthz || exit 1
