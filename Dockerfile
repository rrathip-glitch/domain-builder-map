# Hosted copy of the Domain builder map (data is prebuilt locally; nothing is built in the image).
FROM node:22-slim
WORKDIR /app
COPY package.json ./
COPY app ./app
COPY data/dist ./data/dist
COPY exports ./exports
ENV NODE_ENV=production
CMD ["node", "app/gate.mjs"]
