# Hosting a Shared Read-Only Grafana on Fly.io

## The Goal

You want colleagues to visit a URL, see the six scenario dashboards running live, interact with them (change time range, switch scenarios, explore the 3D plugin), but **not** be able to save changes, create panels, or affect what other users see. One shared live instance, read-only for everyone.

---

## Grafana's Viewer Role

Grafana has a built-in role called **Viewer**. A Viewer can:
- Browse and interact with any dashboard
- Change the time range for their own session
- Use template variables and panel controls

A Viewer cannot:
- Save dashboard changes
- Create or delete dashboards, data sources, or users
- Affect any other user's session

The solution is to make **anonymous access** use the Viewer role. Grafana supports this natively with two config options:

```ini
[auth.anonymous]
enabled = true
org_name = Main Org.
org_role = Viewer
```

With this set, anyone who opens the Fly.io URL gets Viewer access immediately — no login required. They get their own browser session with independent time range and panel state, completely isolated from other visitors. No user can overwrite another user's view because nothing is ever saved back to the database; dashboards are provisioned (read from files) and immutable.

---

## Preventing Any Edits

Since the dashboards are provisioned from JSON files baked into the image, the **Edit** and **Save** buttons are greyed out by default for provisioned dashboards regardless of role. Even if someone somehow got Editor access, they could not persist changes to a provisioned dashboard. This is a second layer of protection on top of the Viewer role.

You can additionally set:

```ini
[users]
allow_sign_up = false
allow_org_create = false

[auth]
disable_login_form = false  # keep if you want an admin back door
```

This prevents anyone from registering an account through the UI.

---

## Admin Access for You

You keep a separate admin account (credentials stored as Fly.io secrets, never in the repo) to log in when you need to do maintenance. Anonymous visitors never see the login form unless they navigate to `/login` directly, and even then they cannot create accounts.

---

## What Colleagues Experience

They receive a URL like `https://grafana-satellite.fly.dev`. They open it, the dashboards are immediately visible, they can explore all six scenarios, interact with the 3D Cesium plugin, scrub the timeline — and when they close the tab, nothing has changed for the next visitor. Exactly like a read-only demo site.

---

## One Risk to Plan For

Fly.io scales to zero by default on the free tier — the container sleeps after inactivity and the first request after sleep takes 5–10 seconds to wake. For a demo you may want to set `min_machines_running = 1` in `fly.toml` to keep it always warm.
