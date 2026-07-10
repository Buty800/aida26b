FROM node:25-alpine

WORKDIR /app/backend

# Copy package files first for better layer caching
COPY backend/package.json backend/package-lock.json* ./

# Install dependencies from the lockfile
RUN npm ci

# Copy runtime inputs
COPY backend/src ./src
COPY backend/tsconfig.json ./
COPY tsconfig.base.json /app/tsconfig.base.json
COPY shared/src /app/shared/src
COPY database/migrations /app/database/migrations

EXPOSE 3000

# Run migrations and ensure the first admin exists before starting the API
CMD ["sh", "-c", "npm run migrate && npm run seed-admin && npm run dev"]
