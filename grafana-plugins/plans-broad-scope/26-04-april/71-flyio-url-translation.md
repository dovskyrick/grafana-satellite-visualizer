# URL Translation — Local to Fly.io Internal Network

## How It Works

In your local setup the Infinity/HTTP data source in Grafana points to something like `http://localhost:3001` or `http://mockup-digital-twin:3001` (the Docker Compose service name). That URL is stored in the **data source definition**, not inside each panel. Every panel just references the data source by name and appends a path like `/api/trajectory?scenario=1`.

On Fly.io, every app gets a private DNS name on the `.internal` domain: `mockup-digital-twin.internal`. The two containers (Grafana and the digital twin) share a private network on Fly.io by default — they can reach each other by that hostname without exposing anything to the internet.

## The Translation

You change exactly **one thing**: the data source provisioning YAML.

```yaml
# provisioning/datasources/datasource.yaml
datasources:
  - name: DigitalTwin
    type: yesoreyeram-infinity-datasource
    url: http://mockup-digital-twin.internal:3001
```

Locally you use `http://localhost:3001`. On Fly.io you use `http://mockup-digital-twin.internal:3001`. Everything else — every panel query, every endpoint path, every scenario parameter — stays identical. You can manage this with a single environment variable (`DIGITAL_TWIN_URL`) substituted into the YAML at container startup via `envsubst`, so local and deployed builds use the same file with different env vars.
