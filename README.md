# @releval/tracker

A lightweight JavaScript library for tracking [User Behavior Insights](https://www.ubisearch.dev/) on websites.
It reports searches, result impressions, result clicks, and the conversions that follow, to a [Releval](https://releval.co) deployment, using the standard UBI event shape so everything joins back to the originating query.

The full integration guide, covering Site registration, the `query_id` flow, and how the pieces fit together, is [Browser tracker](https://releval.co/docs/user-behavior-insights/browser-tracker) in the Releval documentation.

Highlights:

- High-level API for the core search interactions: `trackSearch`, `trackResultImpression`, `trackResultClick`, `trackResultEvent`
- Click-time attribution: a conversion on a later page automatically resolves the query that produced it
- Declarative collectors that bind server-rendered markup via data attributes
- React adapter on the `@releval/tracker/react` subpath
- Batched delivery with retries, plus the Beacon API for events fired during page unload
- Automatic session and anonymous client IDs
- Full TypeScript definitions, one runtime dependency ([ulidx](https://github.com/perry-mitchell/ulidx)), ~8.4 kB gzipped

## Installation

```bash
npm install @releval/tracker
```

Without a bundler, serve the IIFE build (`dist/releval-tracker.global.js`) from your own static assets and load it with a `<script>` tag; it exposes a global `Releval`.
The same file is available as the `./script` subpath (`import '@releval/tracker/script'`) and via jsDelivr/unpkg, though self-hosting is recommended.

You also need a **Site** registered in your deployment of Releval before events will be accepted.
A Site issues the public `site_id` the tracker stamps on every event and declares which origins may submit them.
Events carrying an unknown `site_id`, or arriving from an origin outside the allow list, are dropped.
See [Sites](https://releval.co/docs/user-behavior-insights/sites).

The tracker works with Releval v1.0.0 and later.

## Quick start

### ES module (React, Vue, Angular, etc.)

In a single-page app you call the tracking methods directly.
Report the search when your backend returns results, then report impressions and clicks against that `query_id`:

```typescript
import { Tracker } from '@releval/tracker';

const tracker = new Tracker({
  application: 'my-app',
  siteId: 'YOUR_SITE_ID', // issued by Releval when you register a Site
  endpointHost: 'https://releval.example.com', // the URL browsers use to reach Releval
});

tracker.start();

// When your search backend returns results (it issues the query_id):
tracker.trackSearch({ query: 'wireless headphones', queryId: response.query_id });

// When a result scrolls into view:
tracker.trackResultImpression({
  queryId: response.query_id,
  query: 'wireless headphones',
  items: results.map((r, i) => ({ objectId: r.sku, ordinal: i + 1 })),
});

// When the user clicks a result (also records attribution for later conversions):
tracker.trackResultClick({
  queryId: response.query_id,
  query: 'wireless headphones',
  objectId: result.sku,
  ordinal: rank, // absolute 1-based rank across pagination
});

// Later - another route, or after a full page navigation - the conversion
// picks up the query recorded at click time:
tracker.trackResultEvent({ actionName: 'add_to_cart', objectId: result.sku });
```

Omit `endpointHost` during development and events are logged to the console instead of being sent anywhere.

### React

The `@releval/tracker/react` subpath ships a provider that owns the tracker's lifecycle, a hook to read it, a `SearchResults` context declaring which search produced the results beneath it, and a ref hook for impressions.
React is an optional peer dependency, so this is only pulled in when you import it.
The entry carries the `'use client'` directive, so it works under the Next.js App Router.

```tsx
import {
  SearchResults,
  TrackerProvider,
  useResultImpression,
  useSearchResults,
  useTracker,
} from '@releval/tracker/react';

function Root() {
  return (
    <TrackerProvider options={{ application: 'my-app', siteId: 'YOUR_SITE_ID', endpointHost: 'https://releval.example.com' }}>
      <App />
    </TrackerProvider>
  );
}

function ResultsPage({ response, query }) {
  return (
    <SearchResults queryId={response.query_id} query={query}>
      {response.results.map((r, i) => (
        <ResultCard key={r.sku} result={r} ordinal={i + 1} />
      ))}
    </SearchResults>
  );
}

function ResultCard({ result, ordinal }) {
  const tracker = useTracker();
  const search = useSearchResults();
  // One impression per query, the first time the card becomes visible.
  const ref = useResultImpression({ objectId: result.sku, ordinal });
  return (
    <article
      ref={ref}
      onClick={() =>
        search &&
        tracker.trackResultClick({
          objectId: result.sku,
          ordinal,
          queryId: search.queryId,
          query: search.query,
        })
      }
    >
      {result.name}
    </article>
  );
}
```

`TrackerProvider` starts the tracker on mount and stops it on unmount, and `options` is read once. If you need to change
identity after login, use `tracker.setUserId`.
Events dispatched by child mount effects before the provider starts are buffered and replayed, so nothing is lost on a hard load of a deep route.
`useTracker()` throws if used outside a provider.

### Script tag (no bundler)

Load the IIFE build, then configure the tracker in a `defer`red script that runs after it:

```html
<script defer src="path/to/releval-tracker.global.js"></script>
<script defer src="tracker-setup.js"></script>
```

Server-rendered pages can bind results declaratively: put

1. `data-query-id` (and optionally `data-query`) on the results container
2. `data-object-id` and `data-ordinal` on each result, and the collectors will do the rest:

```javascript
// tracker-setup.js - runs after the deferred library above has loaded
var tracker = new Releval.Tracker({
  application: 'my-site',
  siteId: 'YOUR_SITE_ID', // issued by Releval when you register a Site
  endpointHost: 'https://releval.example.com',
});

tracker.trackResultClicks({
  selector: '[data-query-id] [data-object-id]',
  ignore: '[data-add-to-cart]', // nested buttons are not result clicks
});
tracker.trackResultImpressions({
  selector: '[data-query-id] [data-object-id]',
});

// Conversions: buttons carrying data-action-name (e.g. "add_to_cart") are
// routed through trackResultEvent, which resolves the originating query
// from the recorded result click - on this page or a later one.
tracker.trackResultClicks({ selector: '[data-add-to-cart]' });

// Report the search this page was rendered for, so queries with no clicks
// are still recorded.
var grid = document.querySelector('[data-query-id]');
if (grid) {
  tracker.trackSearch({ queryId: grid.dataset.queryId, query: grid.dataset.query });
}

tracker.start();
```

```html
<div data-query-id="<%= queryId %>" data-query="<%= query %>">
  <a data-object-id="SKU-1" data-ordinal="1" href="/p/SKU-1">...
    <button data-add-to-cart data-object-id="SKU-1" data-action-name="add_to_cart">Add</button>
  </a>
</div>
```

Every full-page navigation builds a fresh `Tracker`, so this setup runs again on each page.
That is fine: the client ID, session, and click-time attribution persist in browser storage, so a conversion several pages later still resolves its query.
Attribution is scoped to a session (30-minute inactivity window by default), so a conversion in a later session is
sent unattributed rather than joined to a stale query.
When results come back on the same page (e.g. an AJAX search), also report the search itself: `tracker.trackSearch({ query, queryId })`.

## What you can track

### Searches

```typescript
tracker.trackSearch({ query, queryId });
```

Reports the search itself as a `search` event with `message_type: QUERY`.
Call it when your backend returns results, so that queries with no clicks are still recorded and abandonment can be measured.
The `queryId` comes from your search backend's track-query call to Releval; the tracker never invents one.

### Result impressions

```typescript
tracker.trackResultImpression({ items: [{ objectId, ordinal }], queryId, query? });
```

One impression per result that became visible, deduplicated per `(queryId, objectId)` for the life of the tracker.
In React, prefer the `useResultImpression` ref hook, which fires when the element first becomes visible.

### Result clicks

```typescript
tracker.trackResultClick({ objectId, ordinal, queryId, query?, objectIdField?, actionName? });
```

Reports a click on a result.
`queryId` and `ordinal` are required, so the click can always be joined back to the query and rank that produced it.
The click also records attribution for the object, which later conversions use.

### Conversions

```typescript
tracker.trackResultEvent({ actionName, objectId, ordinal?, queryId?, query?, objectIdField? });
```

Reports a follow-on action such as `add_to_cart`, `purchase`, or `view`.
`queryId` and `ordinal` are optional here: when omitted, they resolve from the attribution recorded by `trackResultClick` for the same `objectId` - on this page or a later one.
`tracker.getResultAttribution(objectId)` returns the recorded attribution (`{ queryId, ordinal?, query? } | undefined`) if you need it for a custom payload.

### Custom events

```typescript
tracker.dispatch({ action_name: 'begin_checkout', event_attributes: { cart_total: total } });
```

Sends any event through the pipeline when none of the high-level methods fit.
The pipeline stamps `timestamp`, IDs, and context onto the object you pass (it is mutated, not copied).
`EventAttributes`, `EventObject` and `EventPosition` types are exported.

### Declarative collectors

For server-rendered pages, bind results by data attributes instead of writing per-interaction code.
Both methods return a function that stops the collection again.

```typescript
tracker.trackResultClicks({ selector, root?, ignore?, resolve? });      // result clicks
tracker.trackResultImpressions({ selector, root?, resolve? });          // one impression per visible result
```

The default resolver reads `data-object-id`, `data-ordinal`, `data-object-id-field` and optionally `data-action-name` from the matched element, and `data-query-id` / `data-query` from the nearest ancestor carrying `data-query-id` (the element itself counts).
A custom `resolve(element)` can read anything else; returning `undefined` skips the element.
The default resolution is exported as `readResultData` for custom resolvers that only need to add to it.
Clicks that cannot be resolved into a complete event are skipped with a single warning, and an ordinal must be a positive integer.
Elements added or re-rendered after `start()` are covered automatically (delegation plus a mutation observer).
Keep the selector scoped to your result elements: one that matches `<body>` itself is skipped with a warning.

### About `ordinal`

`ordinal` is the absolute, 1-based rank across pagination: `(page - 1) * pageSize + positionOnPage` with `page` 1-based.
It must equal index + 1 of the object in the `query_response_hit_ids` your backend sent to track-query for that `query_id`.
So either one `query_id` spans all pages with absolute ordinals, or each page fetch is its own track-query call.
An `ordinal` that is not a positive integer is dropped with a one-time warning rather than sent.

### What is attached automatically

Every event is enriched before delivery with:

- `timestamp`, a per-event `event_id` (ULID), and the tracker version
- `application`, `site_id`, and `user_id` from your options
- `session_id` and `client_id` (see [Identity](#identity))
- `event_attributes.browser` (user agent, language, screen; `webdriver: true` when automation is detected, so bot traffic can be filtered in analysis)
- `event_attributes.page` (URL, title, referrer)

You can add your own context with a custom enricher, or mirror events to another destination with a custom sink.
Both return a disposer:

```typescript
tracker.addEnricher({
  enrich(event) {
    event.event_attributes.experiment = { variant: 'b' }; // your A/B split key
  },
});

tracker.addSink({
  emit(event) {
    myAnalytics.send(event);
  },
});
```

## Configuration

Delivering to Releval requires the pair `endpointHost` + `siteId` together (the TypeScript type enforces it).
Omit `endpointHost` for development mode: events go to the console - or only to sinks you add, once any are added - and nothing leaves the page.
With env-driven config, spread the pair together so the type holds:

```typescript
const tracker = new Tracker({
  application: 'my-app',
  ...(import.meta.env.VITE_RELEVAL_HOST
    ? {
        endpointHost: import.meta.env.VITE_RELEVAL_HOST,
        siteId: import.meta.env.VITE_RELEVAL_SITE_ID,
      }
    : {}),
});
```

| Option | Type | Default | Description |
|---|---|---|---|
| `application` | `string` | *required* | Application name attached to every event. Match it to what your backend sends to track-query. |
| `endpointHost` | `string` | `undefined` | Base URL browsers use to reach the Releval deployment - not your site's own origin. A reverse-proxy path prefix is allowed; events POST to `<endpointHost>/api/v1/ubi/track-event`. |
| `siteId` | `string` | `undefined` | Public Site identifier issued by Releval. Required with `endpointHost`; events whose `site_id` does not match a registered Site are dropped server-side. |
| `userId` | `string` | `undefined` | Initial user id. Must be an opaque, pseudonymous identifier - never an email. Change it mid-session with `setUserId`. |
| `sessionInactivityTimeoutMs` | `number` | `1800000` (30 min) | Inactivity timeout before rotating the session |
| `maxSessionDurationMs` | `number` | `86400000` (24 hr) | Max session duration before forced rotation |
| `debug` | `boolean` | `false` | Log every dispatched event and every delivery outcome to the console. Useful when setting up: the server accepts every request with `202` and validates asynchronously, so a logged delivery proves transport, not acceptance - confirm arrival in the Site's activity column in Releval. |
| `logger` | `Logger` | `ConsoleLogger` | Replace the default console logger to route (or silence) tracker diagnostics. To fan out to several destinations, pass a logger that wraps them. |

## Identity

| Member | Description |
|---|---|
| `sessionId` | Current session ID (auto-rotates on inactivity or max duration; a page load counts as activity) |
| `clientId` | Stable anonymous client ID (persisted in `localStorage`) |
| `setUserId(id \| undefined)` | Set or clear the user id mid-session (login/logout). Applies to events dispatched after the call; an explicit `user_id` on an event still wins. |

Forward `tracker.clientId` (and `tracker.sessionId`) with your search request, and have your backend pass the client id as `client_id` on its track-query call.
It is the only browser-side key on the query record, so without it queries cannot be joined to browser events - including queries that got no clicks at all.

## Lifecycle

```typescript
tracker.start();        // Attach collectors, replay anything dispatched early, start the session
await tracker.flush();  // Force-deliver queued events now (e.g. before a critical action)
tracker.stop();         // Detach collectors, flush pending events
```

Dispatches before `start()` are buffered (bounded, stamped with the moment they happened and the user identity current at the time) and replayed at `start()` - framework lifecycles routinely dispatch first.
Dispatches after `stop()` are dropped, not queued.
`flush()` resolves once the current batch has been sent.
On a normal page unload you do not need it - delivery already falls back to the Beacon API.

## Examples

Two example apps demonstrate the library in different integration styles:

| Example | Path | Description |
|---|---|---|
| **HTML script tag** | [`examples/html-script/`](examples/html-script/) | Multi-page e-commerce site using the IIFE build, declarative collectors and cross-page attribution |
| **React SPA** | [`examples/react-spa/`](examples/react-spa/) | Single-page React app (Vite + Chakra UI + React Router) using the ESM build and the React adapter |

Both implement a "RelevalTech" storefront with catalog, product detail, cart, and checkout pages, a floating event log panel, and the full search, impression, click, and conversion flow.

## Developing

See [DEVELOPING.md](DEVELOPING.md) for project structure, development commands, architecture, and build outputs.
