# Stage 1: Build
FROM oven/bun:latest AS builder

WORKDIR /app

# Copy package files
COPY server/package.json server/bun.lockb* ./
COPY server/prisma ./prisma/

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY server/src ./src/
COPY server/tsconfig.json ./

# Generate Prisma Client
RUN bunx prisma generate

# Stage 2: Production
FROM oven/bun:latest

WORKDIR /app

# Copy dependencies and generated files from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma

# Copy source code
COPY server/src ./src/
COPY server/package.json ./

# Create public directory for PDFs
RUN mkdir -p /app/public

# Expose port
EXPOSE 8801

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD bun run -e "fetch('http://localhost:8801/health').then(r => r.ok ? process.exit(0) : process.exit(1))" || exit 1

# Start server
CMD ["bun", "run", "start"]
