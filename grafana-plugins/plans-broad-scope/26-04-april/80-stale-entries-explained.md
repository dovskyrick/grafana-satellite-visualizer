# Why Stale Entries Accumulate (and Why It Doesn't Matter)

The `confidenceStore` object in memory is a dictionary keyed by satellite ID (e.g. `"sat-2A"`, `"sat-2B"`). Each time a user submits a confidence rating, the entry for that satellite ID is **overwritten** — not appended. So after 30 users all submit ratings for the same two satellites, the store still only has two keys. There is no unbounded growth.

The word "stale" just means: an entry exists in the dictionary whose `resetAt` timestamp is in the past. It is not deleted — it just sits there doing nothing until the next submission for the same satellite ID overwrites it.

In practice, with only 2 satellites in scenario 2, the store will never have more than 2 entries, ever. The concern about accumulation was overstated in the previous note — it simply does not apply at this scale. Ignore it.
