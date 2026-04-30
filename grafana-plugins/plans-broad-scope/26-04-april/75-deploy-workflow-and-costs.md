# Deploy Workflow & Costs

## Cost of Multiple Deploys

No. Fly.io charges for **running machines**, not for the number of deploys. Each `flyctl deploy` builds a new image and replaces the running machine — the build happens on Fly's Depot builder (free), and you only pay for the machine uptime you already have. Deploying 20 times in a day costs the same as deploying once. The only caveat is that during a rolling deploy there are briefly two machines running simultaneously for a few seconds — negligible cost.

---

## How Your Cesium Plugin Gets Into the Fly.io Container

This is the key part of the `Dockerfile.fly`:

```dockerfile
COPY --chown=grafana:grafana grafana-plugins/3d-orbit-attitude-plugin/dist \
     /var/lib/grafana-plugins/lucasbremond-satellitevisualizer-panel
```

It copies the **compiled `dist` folder** of your plugin directly into the image at build time. So the flow is:

1. You make code changes in `grafana-plugins/3d-orbit-attitude-plugin/src/`
2. You run `npm run build` (or `npm run dev` locally to test first) — this compiles TypeScript and bundles everything into `dist/`
3. You run `flyctl deploy` from the repo root
4. Fly builds a new Docker image, copying whatever is currently in `dist/` into the image
5. The new Grafana container starts with your updated plugin baked in

**Important:** `dist/` must be up to date before you deploy. If you forget to build, the deployed plugin will be the previous compiled version even if your source code changed. The `dist/` folder is what actually ships — not the TypeScript source.

The plugin is loaded from `/var/lib/grafana-plugins/` (separate from the volume-mounted `/var/lib/grafana`), which means it is **never overwritten by the persistent volume** — plugin updates always take effect on redeploy regardless of what is stored in the Grafana data volume.
