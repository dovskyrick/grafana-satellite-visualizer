# Multi-User Session Isolation for Scenario 2

## The Core Problem

The mockup digital twin holds a single global confidence state for all satellites. When user A submits a confidence rating, user B immediately sees that rating. Worse, when you want to demo to a fresh user, you can no longer reset state by restarting Docker — the server is on Fly.io. You need per-session isolation without building real user accounts.

---

## The Timing Problem With the Hash Approach

The intuition of "generate a session hash in the browser and send it with every request" is correct, but you immediately hit the timing wall you identified: the Cesium plugin and the Infinity datasource table panel both fire requests at page load. They fire in parallel — there is no guaranteed ordering. You cannot make the table "wait" for the Cesium plugin to register a session first, because the Infinity datasource is a standard Grafana plugin that has no knowledge of the Cesium plugin's lifecycle.

This rules out any architecture where one plugin must speak to the digital twin before the other plugin does.

---

## The Elegant Fix: Lazy Initialization at the Digital Twin

The key insight is that initialization does not need to be a separate step. Instead, every endpoint in the digital twin (`/api/confidence`, `/api/risk`, `/api/tca-marker`, etc.) performs a lazy check:

1. Read the `sessionId` query parameter from the incoming request.
2. Look up that session ID in an in-memory map (or a small JSON file).
3. If not found → initialize it with default unassigned values, add it to the map, respond with defaults.
4. If found → respond with the stored values.

It does not matter which panel requests first. The first request of any kind from a new session creates the session atomically. Subsequent parallel requests from the same session find it already initialized and get the same consistent defaults. No race condition, no ordering dependency.

---

## How the Session ID Gets Into Every Request

This is where Grafana's **template variables** solve your problem cleanly. Grafana URL template variables are query parameters that all panels on the dashboard share automatically.

**Implementation steps:**

1. Add a hidden Grafana dashboard variable called `sessionId` with a default value of `new` or empty string.
2. In the Cesium plugin, on mount, generate or retrieve a UUID from `localStorage`:
   ```typescript
   let sid = localStorage.getItem('session_id');
   if (!sid) { sid = crypto.randomUUID(); localStorage.setItem('session_id', sid); }
   ```
   Then push it into the Grafana URL using `locationService.partial({ 'var-sessionId': sid })`. This updates the URL and Grafana propagates the variable to all panels.
3. In every Infinity datasource URL in the table panels, append `?sessionId=${sessionId}`. Grafana substitutes the variable automatically.
4. In the Cesium plugin, append `?sessionId=...` to its own digital twin requests.

Now every request from every panel carries the same session ID. The digital twin lazily initializes per session.

---

## Daily Reset

In the digital twin server, run a simple `setInterval` every 24 hours that clears the session map entirely:
```typescript
setInterval(() => { sessionStore.clear(); }, 24 * 60 * 60 * 1000);
```
All users get fresh state the next day. No database, no cleanup scripts, no Fly.io intervention needed.

---

## Verdict

Difficulty: **4/10**. The lazy initialization pattern is three extra lines per endpoint. The `locationService.partial()` call in the Cesium plugin is one line. The Grafana variable wiring is a two-minute UI operation. The daily reset is one `setInterval`. No collision risk for 30–40 concurrent users with UUID v4 (collision probability is astronomically low).
