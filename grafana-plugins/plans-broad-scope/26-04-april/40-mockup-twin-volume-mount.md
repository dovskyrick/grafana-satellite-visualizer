# Mockup Twin: Volume Mount for Fast Iteration

Added `../mockup-digital-twin/src:/app/src` as a volume mount in `docker-compose.yml` and created a `.dockerignore` excluding `node_modules` and `dist`. The container's `node_modules` (installed once at build time) are preserved inside the image and never conflict with the mounted source. After any code change, `docker-compose restart mockup-twin` (~2s) is all that's needed — no rebuild, no `npm install`. The grafana plugin volumes already use the same WSL path pattern, confirming WSL mounts work fine.
