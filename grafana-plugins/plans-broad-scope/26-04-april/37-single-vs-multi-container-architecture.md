# Single Container vs Multi-Container Architecture

## Is One Container Possible?

Yes, technically. A single Docker image can run multiple processes using a process supervisor like `supervisord` or a simple shell entrypoint script that starts both Grafana and the Node.js server. Inside the container they communicate over `localhost:3001` with no networking complexity. The image is one artifact, one `fly deploy` command, one URL. For a research prototype demoed to a small number of people this is workable.

## Why the Industry Recommends Separate Containers

The Docker philosophy is **one process per container**. This is not dogma — it has practical consequences:

**Failure isolation.** If the Node.js server crashes inside a single container, Grafana keeps running but returns empty data with no visible error. You have no automatic restart of just the server process unless you add a supervisor. In separate containers, Docker's own restart policy handles each independently — `restart: unless-stopped` brings back whichever one died.

**Logging.** Docker's log driver captures stdout/stderr of PID 1 (the main process). In a multi-process container, logs from the secondary process either get mixed in or silently dropped unless you pipe them explicitly. On fly.io's dashboard you would see one undifferentiated log stream. With two containers you get two clean log streams you can inspect separately.

**Deployment independence.** In the long run you may want to update the mockup server without restarting Grafana (which would disconnect all live users). Separate services allow rolling updates. Fly.io supports this natively.

**Resource limits.** Fly.io lets you set CPU/memory per machine. One container means one budget for both processes, which can make it hard to tell which one is consuming resources.

## Recommended Architecture for Fly.io

Two separate Fly machines (or a `fly.toml` with two services):

- **grafana** — the existing Docker image, port 3000 exposed publicly
- **mockup-twin** — a small Node.js Dockerfile (3 lines: `FROM node:20-alpine`, copy built files, `CMD node dist/server.js`), port 3001 internal only

On Fly.io, services in the same app can reach each other over a private WireGuard network (`<service>.internal`). Grafana's Infinity datasource URL becomes `http://mockup-twin.internal:3001/api/risk?from=${__from}&to=${__to}`. No public exposure of the API needed.

## Recommendation

For the current development phase: fix the local networking with `extra_hosts` (already done) and keep both running separately in WSL + Docker as they are now. When deploying to fly.io, take the two-container approach from the start. The effort to write a four-line Dockerfile for the Node server is minimal and the operational benefits over the lifetime of the project are significant.
