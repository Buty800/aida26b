FROM node:25-alpine

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json* ./

# Install dependencies from the lockfile
RUN npm ci

# Copy source code
COPY src ./src
COPY styles ./styles
COPY index.html ./
COPY tsconfig.json ./
COPY webpack*.js ./

# Build the application
RUN npm run build

# Start the webpack development server with the API proxy
EXPOSE 8080
CMD ["npm", "run", "dev"]
