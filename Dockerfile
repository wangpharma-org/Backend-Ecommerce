FROM node:22-alpine AS builder

WORKDIR /app

ARG NODE_ENV=development
ENV NODE_ENV=${NODE_ENV}

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

FROM node:22-alpine

WORKDIR /app

ARG NODE_ENV=production
ARG PORT=3000

ENV NODE_ENV=${NODE_ENV}
ENV PORT=${PORT}

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

EXPOSE ${PORT}

CMD ["node", "dist/main"]
