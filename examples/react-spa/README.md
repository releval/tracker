# React SPA Example

A multi-page e-commerce storefront ("RelevalTech") built with React, Vite, Chakra UI v3, and React Router. It demonstrates the tracker's ESM build and the `@releval/tracker/react` adapter in a modern React application.

## Running

1. Build the library from the repo root:

   ```bash
   cd src/tracker
   npm run build
   ```

2. Install and start the dev server:

   ```bash
   cd examples/react-spa
   npm install
   npm run dev
   ```

3. Open `http://localhost:5173` in your browser.

## Walkthrough

Open the floating **Event Log** panel (bottom-right), then:

1. **Search** on `/catalog` - `CatalogPage` gets a `query_id` from a mock search API (a real backend mints it via Releval track-query) and calls `trackSearch`, emitting a canonical `search` event.
2. **Impressions** - the results are wrapped in the library's `<SearchResults queryId query>` context; each `ProductCard` uses `useResultImpression`, so one canonical `impression` fires per card per query as it becomes visible.
3. **Click a result** - the card calls `trackResultClick` with the context's `query_id`, recording attribution for the product.
4. **On the product route** - the `view` and `add_to_cart` events use `trackResultEvent` and resolve the SAME `query_id`/ordinal from the recorded click. Expand them in the panel to verify.
5. **Hard-load a product route** (paste `/product/NT-001` into the address bar) - the mount effect dispatches before the provider has started; the tracker buffers and replays it, so the `view` still appears.
6. **Cards outside a search** (home page, related products) report no result events at all: there is nothing joinable to say.

## Features demonstrated

| Feature                    | Where to see it                                                                                                                                                                                     |
|----------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Provider + useTracker**  | `src/main.tsx` wraps the app in `<TrackerProvider>`; components read the instance with `useTracker()`. The provider owns `start()`/`stop()`, and the fan-out logger travels as the `logger` option. |
| **One-time wiring**        | `setupTracking` in `src/tracker.ts` runs once via `onInit`: sinks and the store enricher. Nothing else needs wiring - tracking is done where the data lives.                                        |
| **SearchResults context**  | `CatalogPage` wraps search results in `<SearchResults>`; cards read it with `useSearchResults()` instead of prop-threading the query id.                                                            |
| **useResultImpression**    | `ProductCard` gets a callback ref that fires one canonical impression per query, StrictMode-safe, re-arming when the query changes.                                                                 |
| **Click-time attribution** | `trackResultClick` on the card records `objectId -> query`; `trackResultEvent` on later routes (product view, add_to_cart, purchase) resolves it.                                                   |
| **Pre-start buffering**    | `ProductPage`'s mount effect dispatches on a hard load before the provider starts; the event is buffered and replayed.                                                                              |
| **Custom enricher**        | Every event includes `event_attributes.store`.                                                                                                                                                      |
| **Custom logger**          | Internal tracker diagnostics (debug/info/warn/error) appear in the Event Log panel alongside events, including the `debug`-level "dispatching event" lines.                                         |
| **Session & client ID**    | The panel header displays both, read from `useTracker()`.                                                                                                                                           |

## Project structure

```
src/
  main.tsx              React entry; wraps <App> in <TrackerProvider> (options + onInit)
  App.tsx               ChakraProvider + BrowserRouter + Routes
  tracker.ts            setupTracking() + fan-out logger + event log pub/sub
  toaster.ts            Chakra toast instance for add-to-cart notifications
  cart.ts               localStorage-backed cart state with React subscriptions
  products.ts           Product definitions
  ProductSvg.tsx        SVG images for each product
  components/
    Layout.tsx          Shell with nav bar (cart badge) and event log
    EventLog.tsx        Floating panel rendering captured events
    SessionInfo.tsx     Displays sessionId and clientId
    ProductCard.tsx     Result card: useResultImpression + trackResultClick + add-to-cart conversion
    SearchBar.tsx       Search input with suggestions (the search itself is reported by CatalogPage)
  pages/
    HomePage.tsx        Featured cards outside any search context
    CatalogPage.tsx     trackSearch + <SearchResults> around the result grid
    ProductPage.tsx     Canonical view + add_to_cart resolving recorded attribution
    PromotionPage.tsx   A destination reached without a result click (stays unattributed)
    CartPage.tsx        view, update_cart, canonical remove_from_cart
    CheckoutPage.tsx    begin_checkout, add_shipping_info, one canonical purchase per item
```
