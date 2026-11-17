---
'tinyzoo': patch
---

The shared store (rate limits shared by replicas, realtime updates) and shared editing talk to Redis through ioredis 6 (was 5). Nothing changes for your site: the same `REDIS_URL` / `cms.redis.url` works, and tinyzoo keeps speaking the same Redis protocol as before (RESP2), so a managed Redis, Valkey or a proxy in front of them that worked with tinyzoo 0.2 keeps working.
