FROM node:25-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy source code
COPY src ./src
COPY index.html ./
COPY tsconfig.json ./
COPY copy-static.js ./

# Build the application
RUN npm run build

# Start http-server
EXPOSE 8080
CMD ["npm", "start"]
