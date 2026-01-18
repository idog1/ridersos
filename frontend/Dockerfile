FROM node:20-alpine AS builder
  WORKDIR /app
  COPY package*.json ./
  RUN npm ci
  COPY . .
  RUN npm run build

  FROM nginx:alpine
  COPY --from=builder /app/dist /usr/share/nginx/html
  COPY nginx.conf /etc/nginx/nginx.conf.template
  CMD sh -c "envsubst '\$PORT' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf && nginx -g 'daemon off;'"

  Then:
  code ~/dev/ridersos/frontend/nginx.conf

  Paste and save:
  events {
      worker_connections 1024;
  }

  http {
      include /etc/nginx/mime.types;
      default_type application/octet-stream;

      server {
          listen $PORT;
          server_name _;
          root /usr/share/nginx/html;
          index index.html;

          location / {
              try_files $uri $uri/ /index.html;
          }
      }
  }