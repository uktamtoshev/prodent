# Безопасный выпуск frontend

Frontend выпускается только по точной ссылке `repository@sha256:<64 hex>`, а label образа
обязан совпасть с полным SHA коммита. Сначала образ проходит
полный lint, unit-тесты, E2E и staging. Production защищается ручным подтверждением.

Для окружений `staging` и `production` нужны `SSH_PRIVATE_KEY`,
`SSH_KNOWN_HOSTS`, `SSH_USER`, `SSH_PORT`, `SERVER_HOST` и `APP_URL`. В GitLab
ключ и known_hosts должны быть защищёнными переменными типа File. В GitHub для
окружения `production` можно дополнительно включить Required reviewers.

`APP_URL` должен быть публичным HTTPS base URL без query, token и пароля. После
замены CI проверяет реальный API через этот URL и откатывается при ошибке.

Контейнер подключается к общей сети `prodent-network`. Его healthcheck вызывает
реальный `/api/v1/data/countries`, поэтому выпуск не пройдёт, если nginx не видит
backend. Рабочий frontend заменяется только после успешной проверки кандидата.
При провале итоговой проверки предыдущий контейнер возвращается автоматически.
На первом переходном выпуске также сохраняется старая Compose-сеть, чтобы не
оборвать связь с backend до полного переноса инфраструктуры.

Предыдущий контейнер сохраняется как `prodent-frontend-rollback`. Ручной откат:

GitHub production запускается только вручную workflow `Manual frontend production release`.
Оператор вводит `release_sha` и `release_digest`; workflow сверяет их с артефактом
успешного main/staging run.

Standalone Compose требует `POSTGRES_IMAGE`, `REDIS_IMAGE`, `BACKEND_IMAGE` и `FRONTEND_IMAGE`
в формате `repository@sha256:<64 hex>`, плюс `POSTGRES_PASSWORD`, `REDIS_PASSWORD` и
`JWT_SECRET`. Соседний backend checkout не нужен. Nginx внутри контейнера работает без root
на порту `8080`.

```sh
docker rm -f prodent-frontend
docker rename prodent-frontend-rollback prodent-frontend
docker start prodent-frontend
docker inspect --format '{{.State.Health.Status}}' prodent-frontend
```
