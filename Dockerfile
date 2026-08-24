# Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package definition and install dependencies
COPY package*.json ./
RUN npm ci

# Copy all source files
COPY . .

# Build frontend and backend
RUN npm run build

# Production Stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY package*.json ./
RUN npm ci --only=production

# Copy built dist directory from builder stage
COPY --from=builder /app/dist ./dist

EXPOSE 3001

CMD ["npm", "start"]
