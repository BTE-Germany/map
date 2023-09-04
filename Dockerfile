FROM node:lts-alpine as build-frontend
WORKDIR /app/frontend
COPY frontend/ .
RUN yarn install
RUN yarn run build

FROM node:lts-alpine as build-backend
WORKDIR /app/backend
COPY backend/ .
RUN yarn install
RUN yarn run build

FROM node:lts
WORKDIR /app

COPY ./entrypoint.sh .

COPY --from=1 /app/backend/prisma/schema.prisma ./backend/prisma/schema.prisma
COPY --from=0 /app/frontend/dist ./frontend

WORKDIR /app/backend
COPY ./backend/package.json .
RUN yarn install --prod
COPY --from=1 /app/backend/dist .
RUN npx prisma generate
EXPOSE 8899

ENTRYPOINT /app/entrypoint.sh
