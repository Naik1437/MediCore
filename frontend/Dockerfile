FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3002

# Minimal non-root placeholder container for frontend
USER node
EXPOSE 3002

CMD ["node", "-e", "const http = require('http'); http.createServer((_, res) => { res.writeHead(200, {'Content-Type': 'application/json'}); res.end(JSON.stringify({ service: 'frontend-stub', batch: 'Batch 2' })); }).listen(3002, () => console.log('Frontend placeholder running on 3002'));"]
