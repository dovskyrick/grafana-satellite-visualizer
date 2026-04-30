# Fly.io Deployment — Dashboard Preservation Strategy

## What "Provisioned" Means

In Grafana, **provisioning** means loading configuration from files on disk at startup rather than from the database. When Grafana starts, it reads YAML or JSON files from a known directory (`/etc/grafana/provisioning/`) and creates dashboards, data sources, and alert rules automatically. The key consequence is that **provisioned resources are read-only inside the UI** — you cannot save edits to them through the browser. They are owned by the file on disk, not by the database. If you restart the container, provisioned dashboards reload from the files exactly as they were; nothing is lost.

This is the correct mechanism for deployment: you commit your dashboard JSON files to the repository, bake them into the Docker image, and Grafana always starts in a known state regardless of what happened to the container before.

---

## What You Currently Have

Your local Grafana instance stores dashboards in its internal SQLite database (the default for self-hosted single-node installs). Every time you build a dashboard through the UI — setting panel queries, connecting to the digital twin endpoints, configuring axes, colours, thresholds — that configuration is written into `grafana.db`. This database lives inside the Grafana container's filesystem. It is **not** in your Git repository right now, and if the container is deleted, those dashboards disappear.

This is the core tension for deployment: your six dashboards exist in a mutable database, not in version-controlled files.

---

## How Much Can Be Preserved — The Good News

Almost everything. Grafana dashboards are fully serializable to JSON. Each dashboard panel — its query, data source connection, visualisation type, field mappings, thresholds, colours — is encoded in a JSON document. You can export any dashboard from the UI right now via **Dashboard settings → JSON Model** or via the Grafana HTTP API. That JSON, combined with a data source provisioning YAML that points to your digital twin container, is a complete and portable description of the dashboard.

The data source connection — the URL of your mockup digital twin — is defined in the data source configuration, not hard-coded per panel. On Fly.io, the two containers (Grafana and digital twin) will communicate over Fly's private network. You will define an environment variable or provisioning YAML with the internal URL, and all panels inherit it automatically. No per-panel URL changes needed.

---

## The December Problem — Why It Won't Repeat

The December hardcoding issue arose because you were using the **TestData** built-in data source with static JSON. TestData embeds its payload directly in the dashboard JSON, so the only way to "deploy" data was to paste it into the dashboard definition. That was the wrong data source for a live system.

Your current setup uses a proper HTTP data source (Infinity or similar) pointing to the digital twin's REST endpoints. The data source just stores a base URL. When exported to JSON and provisioned, the panels keep their query paths (`/api/trajectory`, `/api/attitude`, etc.) and the data source resolves the host at runtime from the provisioning config. Nothing needs to be hardcoded.

---

## The Deployment Path

1. **Export** all six dashboards as JSON from the current UI (Dashboard settings → JSON Model, copy each).
2. **Create** a `provisioning/dashboards/` folder in the repo with those JSON files and a `dashboards.yaml` index file.
3. **Create** a `provisioning/datasources/datasource.yaml` pointing to the digital twin's Fly.io internal hostname.
4. **Bake** the provisioning folder into the Grafana Docker image via `COPY` in the Dockerfile.
5. **Deploy** both containers to Fly.io; the digital twin runs as a companion service on the private network.

The result is a fully reproducible deployment: anyone with the repo can `fly deploy` and get the exact six dashboards, connected and working, in under five minutes.
