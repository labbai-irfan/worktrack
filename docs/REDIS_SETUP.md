# Redis Setup (optional)

Redis is **not required** to run WorkTrack. It becomes useful when you:

- run **multiple backend instances** (Socket.IO needs the Redis adapter so events reach sockets on other nodes),
- want a **shared rate-limit store** instead of per-instance in-memory counters,
- add background **queues** (e.g. scheduled report generation, email delivery).

## Local

```bash
docker compose up redis        # from the repo root (service defined in docker-compose.yml)
# or: docker run -p 6379:6379 redis:7-alpine
```

Set in `backend/.env`:

```
REDIS_URL=redis://localhost:6379
```

## Integration points

The variable is validated but intentionally unused by default. When scaling out:

1. **Socket.IO adapter** — install `@socket.io/redis-adapter` + `redis`, create pub/sub clients from `REDIS_URL` in `backend/src/sockets/index.ts`, and pass `adapter: createAdapter(pub, sub)` to the `Server` options.
2. **Rate limiting** — install `rate-limit-redis` and pass a store to the limiters in `backend/src/middlewares/rateLimit.ts`.

## Production

Use a managed Redis (Upstash, Redis Cloud, ElastiCache). Require TLS (`rediss://`) and set the URL via host environment variables — never commit credentials.
