# 先打开 brook http 代理
# ~/bk socks5tohttp -s 127.0.0.1:1080 -l 0.0.0.0:8011 &


# docker build -t nanjiren01/aichat-web:0.11.4 ../AIChatWeb
# docker push nanjiren01/aichat-web:0.11.4
# docker tag nanjiren01/aichat-web:0.11.4 nanjiren01/aichat-web:pro-latest
# docker push nanjiren01/aichat-web:pro-latest

FROM m.daocloud.io/docker.io/library/node:18-alpine AS builder

WORKDIR /app

COPY package.json yarn.lock ./

#RUN yarn config set registry https://registry.npmmirror.com/
RUN yarn config set proxy http://172.17.0.1:8011
RUN yarn config set https-proxy http://172.17.0.1:8011
RUN yarn install

COPY . .

RUN chmod +x /app/node_modules/.bin/next
RUN chmod +x /app/node_modules/.bin/cross-env

RUN yarn build

# 构建最终容器
FROM m.daocloud.io/docker.io/library/node:18-alpine

WORKDIR /app

COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/.next/server ./.next/server

ENV BASE_URL=http://aichat-admin:8080
ENV SECRET=123456

EXPOSE 3000

CMD node /app/server.js
