# Confidence Level Auto-Reset — 10-Minute TTL

## Concept

Instead of per-user isolation, the digital twin always serves unassigned defaults and applies a 10-minute Time To Live (TTL) to any submitted confidence value. A user opens scenario 2, sees unassigned, submits their rating, sees the updated table, and moves on. Ten minutes later the value resets silently. The next user gets a clean slate. Simple, zero front-end changes needed.

---

## Implementation in `server.ts`

### 1. Replace the static confidence store with a TTL-aware structure

Instead of a plain object `{ [satelliteId]: number }`, store each confidence value alongside a `resetAt` timestamp:

```typescript
interface ConfidenceEntry {
  value: number;
  resetAt: number; // Date.now() + 10 minutes in ms
}

const TTL_MS = 10 * 60 * 1000; // 10 minutes
const confidenceStore: Record<string, ConfidenceEntry> = {};
```

### 2. GET `/api/confidence` — serve default if expired or absent

```typescript
app.get('/api/confidence', (req, res) => {
  const { id } = req.query;
  const entry = confidenceStore[id as string];
  const isValid = entry && Date.now() < entry.resetAt;
  res.json({ id, confidence: isValid ? entry.value : null }); // null = unassigned
});
```

### 3. POST `/api/confidence` — store with TTL

```typescript
app.post('/api/confidence', (req, res) => {
  const { id, confidence } = req.body;
  confidenceStore[id as string] = {
    value: confidence,
    resetAt: Date.now() + TTL_MS,
  };
  res.json({ ok: true });
});
```

### 4. No background job needed

There is no need for a `setInterval` cleanup. Expiry is checked lazily on every GET — if `Date.now() >= resetAt`, it is treated as absent. The store may accumulate a handful of stale entries over time (at most one per satellite per submission cycle) but for 30 users over a month this is negligible memory.

---

## Result

Every user who opens scenario 2 more than 10 minutes after the previous submission will see unassigned values automatically. No restart, no manual reset, no user accounts.
