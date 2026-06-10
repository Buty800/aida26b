FROM node:25-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy source code
COPY src ./src
COPY tsconfig.json ./

# Create the first admin user if not exist
RUN npm run seed-admin

# Expose port
EXPOSE 3000

# Start development server
CMD ["npm", "run", "dev"]
