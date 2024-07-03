FROM node:20-slim
WORKDIR /usr/src/app
COPY package.json package-lock.json ./
RUN yarn --immutable
ENV NODE_ENV="production"
COPY . .
CMD [ "yarn", "start" ]
