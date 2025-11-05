# ═══════════════════════════════════════════════════════════
# STAGE 1: Dependencies - Install only production dependencies
# ═══════════════════════════════════════════════════════════
FROM node:22-alpine AS dependencies

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with clean cache
RUN npm install --production --no-audit && \
    npm cache clean --force

# ═══════════════════════════════════════════════════════════
# STAGE 2: Builder - Build TypeScript application
# ═══════════════════════════════════════════════════════════
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm install --no-audit && npm cache clean --force

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# ═══════════════════════════════════════════════════════════
# STAGE 3: Runtime - Minimal production image
# ═══════════════════════════════════════════════════════════
FROM node:22-alpine AS runtime

# Install dumb-init for proper signal handling & curl for healthcheck
RUN apk add --no-cache dumb-init curl && \
    addgroup -g 1001 hrgenie && \
    adduser -S -u 1001 -G hrgenie hrgenie

WORKDIR /app

# Copy production dependencies from stage 1
COPY --from=dependencies --chown=hrgenie:hrgenie /app/node_modules ./node_modules

# Copy built application from stage 2
COPY --from=builder --chown=hrgenie:hrgenie /app/dist ./dist
COPY --from=builder --chown=hrgenie:hrgenie /app/package.json ./

# Set environment
ENV NODE_ENV=production \
    PORT=5000

# Create logs directory with proper permissions
RUN mkdir -p logs && chown hrgenie:hrgenie logs

# Security: Run as non-root user
USER hrgenie

# Expose application port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:5000/api/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "dist/server.js"]
