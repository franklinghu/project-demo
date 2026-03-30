FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY server/package*.json ./
RUN npm install --production

# Copy source
COPY server/src ./src
COPY server/data ./data

EXPOSE 3001

CMD ["node", "src/index.js"]