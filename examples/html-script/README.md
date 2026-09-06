# HTML Script Tag Example

A multi-page e-commerce storefront ("RelevalTech") that demonstrates the tracker on a classic server-rendered-style site using the IIFE script tag build. Cart state is shared across pages via localStorage.

## Running

1. Build the library from the repo root:

   ```bash
   cd src/tracker
   npm run build
   ```

2. Open `index.html` directly in a browser (no server required).

## Pages

| Page               | File                     | Description                                                                                                                                                                                                                   |
|--------------------|--------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Catalog**        | `index.html`             | Product grid with search and category filters. A search emits a canonical `search` event and renders the grid as a results container (`data-query-id`), so the declarative collectors report joinable clicks and impressions. |
| **Product Detail** | `product.html?id=NT-001` | Canonical `view` + `add_to_cart`, both resolving the originating query from the recorded result click.                                                                                                                        |
| **Cart**           | `cart.html`              | `view`, `update_cart`, and canonical `remove_from_cart` per item.                                                                                                                                                             |
| **Checkout**       | `checkout.html`          | `begin_checkout`, `add_shipping_info`, and one canonical `purchase` per line item.                                                                                                                                            |

## Walkthrough

Open the floating **Event Log** panel (bottom-right), then:

1. **Search** for "audio" on the catalog - a `search` event fires (message_type `QUERY`), and the grid becomes a results container carrying the `query_id`.
2. **Watch impressions** - each visible result card emits one canonical `impression` joined to the query.
3. **Click a result** - a canonical `click` fires (query_id + object_id + ordinal) and the attribution for that product is recorded; the browser navigates to the product page.
4. **On the product page** - the `view` and `add_to_cart` events resolve the SAME `query_id` and ordinal from the recorded click, across the full page navigation. Expand them in the panel to verify.
5. **Checkout** - each purchased line item emits a `purchase` that resolves its own originating query, even when the cart was built from several searches.
6. **Compare** - a product opened from a related-products grid (no search) has no `query_id` on its events: nothing is ever attributed by guesswork.

## What the setup consists of

| Piece                             | Where                                                                                                                                                                                     |
|-----------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Tracker init**                  | `tracker-setup.js`. Configured with `application` and a fan-out `logger` (console + panel). Add the `endpointHost` + `siteId` pair to send to a real deployment.                          |
| **Declarative result collectors** | `tracker-setup.js` binds `trackResultClicks` (with `ignore: '[data-add-to-cart]'` so nested buttons don't inflate CTR) and `trackResultImpressions` once, scoped under `[data-query-id]`. |
| **Conversion collector**          | Buttons carry `data-action-name="add_to_cart"`; one `trackResultClicks` binding routes them through `trackResultEvent`.                                                                   |
| **Data attributes**               | `shared.js` renders `data-object-id` / `data-ordinal` on each card; `index.html` stamps `data-query-id` / `data-query` on the grid when a search ran.                                     |
| **Search reporting**              | `index.html` calls `tracker.trackSearch({ query, queryId })` with the id from a mock search API (a real backend mints it via Releval track-query).                                        |
| **Custom enricher**               | Every event includes `event_attributes.store`.                                                                                                                                            |
| **Custom logger**                 | Internal tracker diagnostics appear in the panel alongside events.                                                                                                                        |
| **Session & client ID**           | Displayed in the panel header; both persist across pages and reloads, which is how continuity works when every page load rebuilds the `Tracker`.                                          |

## File structure

```
index.html          Catalog page (search, categories, product grid)
product.html        Product detail page (?id=NT-001)
promotion.html      Featured-deal page (a destination with no result click)
cart.html           Shopping cart page
checkout.html       Checkout and order confirmation
tracker-setup.js    Tracker configuration - adapt this for your own site
shared.js           Example infrastructure: product data, cart (localStorage), header, event log
```
