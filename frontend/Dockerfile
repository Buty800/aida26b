FROM node:lts-alpine AS builder

WORKDIR /usr/src/app

COPY --chown=node:node package*.json tsconfig.json copy-static.cjs index.html ./
COPY --chown=node:node src ./src

RUN npm install
RUN npm run build
RUN npm ci --silent --omit=dev

FROM node:lts-alpine AS runner

WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/package.json ./package.json

EXPOSE 8080

USER node

CMD ["npm", "start"]
