# Cesium Clock → Live Crosshair in Grafana Time Series Panels

## Is it possible?

Yes. Grafana has an internal event bus that all panels share within a dashboard. The time series panel already listens to `DataHoverEvent` from this bus — that is exactly how the crosshair synchronises across multiple time series panels when you hover over one of them. The vertical line is just a reaction to whatever timestamp lands on that event bus.

A plugin panel has full access to the same event bus via `props.eventBus` in the panel's React props. The Cesium plugin can publish `DataHoverEvent` with the CesiumJS clock's current time at any moment, and every time series panel on the dashboard will draw its crosshair at that timestamp in sync.

## What it would look like

As the Cesium animation plays or the user scrubs the timeline, a live vertical line tracks through the risk curve, link-health, stars-matched, and any other time series panel simultaneously — showing exactly what all telemetry values were at the moment currently displayed in 3D.

## The one practical constraint: throttling

The Cesium clock fires at ~60 fps. Publishing `DataHoverEvent` 60 times per second would flood the event bus and cause visible jank in the time series panels. The fix is a simple throttle — publish at most once every 200–500 ms, or only on meaningful clock jumps above a threshold (e.g. > 1 second elapsed).

## Reverse direction

The same event bus can be listened to inside the Cesium plugin: a hover on any time series panel could snap the Cesium clock to that timestamp, making the sync bidirectional.

## Difficulty: 3/10

The event bus wiring is a few lines. The throttle is one utility function. The main effort is identifying the correct Grafana event class (`DataHoverEvent` from `@grafana/data`) and verifying the payload shape matches what the time series panel expects.
