# Build an image that builds the frontend and runs the Express server
FROM node:18-bullseye-slim AS build
WORKDIR /usr/src/app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Production image
FROM node:18-bullseye-slim AS runtime
WORKDIR /usr/src/app

# Install only production deps
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Copy build output and server files
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/package.json ./package.json
COPY --from=build /usr/src/app/server.ts ./server.ts

EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "dist/server.js"]
