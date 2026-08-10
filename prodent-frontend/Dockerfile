# =========================
# Stage 1: Build frontend
# =========================
FROM node:20.19-alpine@sha256:658d0f63e501824d6c23e06d4bb95c71e7d704537c9d9272f488ac03a370d448 AS builder

# Рабочая директория
WORKDIR /app

# Копируем package файлы отдельно для кэша
COPY package*.json ./

# Установка зависимостей
RUN npm ci --prefer-offline --no-audit --legacy-peer-deps

# Копируем исходники
COPY . .

# Весь код обязан пройти lint. Ошибки блокируют production-образ.
RUN npm run lint

# Критичные unit tests
RUN npm run test:run

# Проверка TypeScript
RUN npm run typecheck

# Сборка проекта
RUN npm run build

# Build the 3D tooth anatomy viewer separately so Three.js does not bloat the
# main public/cabinet bundle. It is still shipped at /tooth-anatomy/.
RUN npm run build:viewer


# =========================
# Stage 2: Production
# =========================
FROM nginxinc/nginx-unprivileged:1.27-alpine@sha256:65e3e85dbaed8ba248841d9d58a899b6197106c23cb0ff1a132b7bfe0547e4c0

USER root

# Удаляем дефолтный nginx html
RUN rm -rf /usr/share/nginx/html/*

# Копируем собранный frontend
#COPY --from=builder /app/build /usr/share/nginx/html

# Если Next.js/Vite может быть dist:
COPY --from=builder --chown=101:101 /app/dist /usr/share/nginx/html
COPY --from=builder --chown=101:101 /app/dist-tooth /usr/share/nginx/html

# Кастомный nginx config (если нужен)
COPY --chown=101:101 nginx.conf /etc/nginx/conf.d/default.conf

# Fail the image build if the production web-server config is invalid.
# nginx -t creates /tmp/nginx.pid as root in this base image; remove it before
# switching to the unprivileged runtime user.
RUN nginx -t && rm -f /tmp/nginx.pid

USER 101

EXPOSE 8080

# Проверяет не только nginx, но и реальный путь /api до backend.
HEALTHCHECK --interval=20s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -q -O /dev/null 'http://127.0.0.1:8080/api/v1/data/countries?select=id&limit=1' || exit 1

CMD ["nginx", "-g", "daemon off;"]
