# 构建阶段
FROM docker.1ms.run/library/node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# 运行阶段
FROM docker.1ms.run/library/nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY docker-entrypoint.d/10-selfsigned-cert.sh /docker-entrypoint.d/10-selfsigned-cert.sh
RUN chmod +x /docker-entrypoint.d/10-selfsigned-cert.sh \
    && apk add --no-cache openssl

ENV NGINX_HOST=121.196.239.144

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
