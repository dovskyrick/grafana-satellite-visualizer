# Making a Single-Point Marker Visible in a Time Series Panel

## The Problem

A time series panel renders everything as a line by default. A single isolated point has no line to draw, so it is invisible unless you hover directly over it. The risk curve looks fine because it has many connected points; the TCA marker (one point) disappears.

## The Fix — Override Style Per Query

Grafana 9+ supports **per-query/series style overrides**. You do not need to split into two panels.

1. Open the panel editor → **Overrides** tab (right-side column, below **Standard options**).
2. Click **+ Add field override**.
3. Choose **Fields with name** → type `TCA` (exactly matching the field name the server returns).
4. Click **+ Add override property**:
   - **Graph styles > Line width** → set to `0` (hides the line).
   - **Graph styles > Points size** → set to `8` or higher (makes the dot large and permanently visible).
   - **Graph styles > Show points** → set to `Always`.
5. Optionally add a **Standard options > Color** override to make it a distinct colour (e.g. red).

The risk curve query keeps its default line style; only the `TCA` series gets the dot-only treatment.

## Result

The TCA marker is now a permanently visible large dot sitting at `1.1` above the bell curve peak, selectable at a glance without needing to hover first.
