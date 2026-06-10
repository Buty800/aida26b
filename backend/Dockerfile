FROM node:lts-alpine AS builder

WORKDIR /usr/src/app

# Backend deps
COPY backend/package*.json ./backend/
WORKDIR /usr/src/app/backend
RUN npm install

# Frontend deps
WORKDIR /usr/src/app
COPY frontend/package*.json ./frontend/
WORKDIR /usr/src/app/frontend
RUN npm install

# Copy source
WORKDIR /usr/src/app
COPY backend ./backend
COPY frontend ./frontend

# Build frontend
WORKDIR /usr/src/app/frontend
RUN npm run build

# Build backend
WORKDIR /usr/src/app/backend
RUN npm run build-backend


FROM node:lts-alpine AS runner

WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/backend/node_modules ./node_modules
COPY --from=builder /usr/src/app/backend/dist ./dist
COPY --from=builder /usr/src/app/backend/package.json ./package.json

# Copy built frontend
COPY --from=builder /usr/src/app/frontend/dist ../frontend/dist

# Use port 3000 in localhost
EXPOSE 3000

CMD ["npm", "start"]