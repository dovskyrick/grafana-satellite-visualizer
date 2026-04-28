# Mockup Digital Twin: Best Dev Iteration Workflow

## The Core Problem

Every `docker-compose up -d --build mockup-twin` rebuilds the image from scratch: copies files, runs `npm install` (~30s), then starts the server. For pure API code changes where no new packages are added this is wasteful.

## Option A — Volume Mount (Recommended for Development)

Mount the source files directly into the container instead of copying them at build time. In `docker-compose.yml`, add a volume to the `mockup-twin` service:

```yaml
volumes:
  - ../mockup-digital-twin/src:/app/src
```

With this, the container always runs the latest source from your WSL filesystem. When you change `server.ts` or `orbit-math.ts`, you only need to restart the container (not rebuild):

```bash
docker-compose restart mockup-twin
```

This takes ~2 seconds. No rebuild, no `npm install`. Packages are still installed once at build time and cached in the image. You only need `--build` when `package.json` changes (new dependency added).

This is the closest to running `npm start` in WSL — fast iteration, no waiting.

## Option B — Keep Running in WSL, Don't Use Docker for Dev

Don't run the mockup server in Docker at all during development. Keep `npm start` in WSL (as before), and only Dockerize when preparing a deployment. Use the `extra_hosts` workaround or the hardcoded IP for local Infinity queries. Switch to the full Docker setup only when deploying to fly.io.

Downside: the Infinity datasource networking problem comes back since it needs server-side resolution.

## Recommendation

**Option A** is the best balance — Docker handles networking cleanly, and the volume mount makes code iteration as fast as running the server directly. The Dockerfile stays minimal and deployment-ready. Add a `.dockerignore` to exclude `node_modules` and prevent conflicts between the host and container filesystems.
