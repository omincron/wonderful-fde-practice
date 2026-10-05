FROM node:22-bookworm-slim
WORKDIR /app
COPY . .
CMD ["npm", "run", "evaluate"]
