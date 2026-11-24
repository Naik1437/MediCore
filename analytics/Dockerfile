FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8002

# Minimal non-root placeholder container for analytics
USER node
EXPOSE 8002

CMD ["node", "-e", "const http = require('http'); http.createServer((_, res) => { res.writeHead(200, {'Content-Type': 'application/json'}); res.end(JSON.stringify({ service: 'analytics-stub', batch: 'Batch 3' })); }).listen(8002, () => console.log('Analytics placeholder running on 8002'));"]
