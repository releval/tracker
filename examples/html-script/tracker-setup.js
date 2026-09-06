// ================================================================
// @releval/tracker configuration
// ================================================================
//
// This file shows how to configure and initialize the tracker on
// a multi-page site using the IIFE (script tag) build.
//
// Adapt this file for your own site. The companion file "shared.js"
// is example-specific infrastructure (product data, cart, UI) and
// is not part of the tracker setup.
//
// Prerequisites (load order matters - all deferred):
//   <script defer src="releval-tracker.global.js"></script>
//   <script defer src="tracker-setup.js"></script>
//
// Because both scripts use `defer`, they execute in document order
// after HTML parsing. By the time this file runs, Releval.Tracker is
// already defined - no polling or callback wrapper needed.
//
// After this script runs, `window.tracker` is ready to use.
// Page-specific tracking code can reference it directly.
// ================================================================

// ---- 1. Logger ----
// The default ConsoleLogger is the only visible feedback in the whole
// pipeline (the server answers 202 to everything), so keep it - and
// fan out to the visual event log panel as well. Fan-out is a plain
// object wrapping both loggers, passed as the `logger` option.
// The tracker's DEBUG diagnostics (every dispatched event, delivery
// outcomes) are noisy, so they are off by default. Set this to true to
// see them in the console and the event log panel.
var SHOW_DEBUG_LOGS = false;

var consoleLogger = new Releval.ConsoleLogger({ verbose: true });
function fanOut(level) {
  return function (msg) {
    consoleLogger[level].apply(consoleLogger, arguments);
    addToEventLog(
      level.toUpperCase(),
      msg,
      Array.prototype.slice.call(arguments, 1)
    );
  };
}

// ---- 2. Create the tracker ----
var tracker = new Releval.Tracker({
  application: 'relevaltech-html',   // Your application name
  logger: {
    debug: SHOW_DEBUG_LOGS ? fanOut('debug') : function () {},
    info: fanOut('info'),
    warn: fanOut('warn'),
    error: fanOut('error')
  }
  // To deliver to a Releval deployment, set the pair together:
  //   endpointHost: 'https://releval.example.com',
  //   siteId: 'YOUR_SITE_ID'  // issued when you register a Site
});

// ---- 3. Sinks ----
// Feed every event to the visual event log panel. (Without an
// endpointHost the tracker would log to the console; an added sink
// replaces that default.)
tracker.addSink({
  emit: function (event) {
    addToEventLog('EVENT', event.action_name || 'unknown', event);
  }
});

// ---- 4. Custom enricher ----
// Adds store metadata to every event. Enrichers run just before the
// event reaches the sinks.
tracker.addEnricher({
  enrich: function (event) {
    if (!event.event_attributes) event.event_attributes = {};
    event.event_attributes.store = {
      name: 'RelevalTech',
      channel: 'web',
      version: '1.0'
    };
  }
});

// ---- 5. Declarative result collection ----
// The results grid is server-rendered markup carrying the documented
// data attributes: data-query-id (and data-query) on the container,
// data-object-id and data-ordinal on each result. One collector binds
// clicks, one binds viewport impressions; both emit the canonical
// joinable shape (query_id + object_id + ordinal) with no hand-built
// events. Scoping the selector under [data-query-id] means cards
// outside a search (related products, an unfiltered catalog) are
// simply not result events.
tracker.trackResultClicks({
  selector: '[data-query-id] [data-object-id]',
  // A click on the nested add-to-cart button must not also count as a
  // result click (that would inflate CTR); it is bound separately below.
  ignore: '[data-add-to-cart]'
});
tracker.trackResultImpressions({
  selector: '[data-query-id] [data-object-id]'
});

// ---- 6. Conversions ----
// Add-to-cart buttons carry data-action-name="add_to_cart", so this
// collector routes them through trackResultEvent: when the product was
// reached by clicking a search result, the originating query_id and
// ordinal are resolved automatically from the recorded click - on this
// page or a later one.
tracker.trackResultClicks({
  selector: '[data-add-to-cart]'
});

// ---- 7. Start the tracker ----
tracker.start();

// ---- 8. Expose globally ----
window.tracker = tracker;

// ---- 9. Wire up UI after DOM is ready ----
// The header is rendered by shared.js renderHeader() in an earlier
// DOMContentLoaded handler, so these elements exist by the time this runs.
document.addEventListener('DOMContentLoaded', function () {
  var idsEl = document.getElementById('event-log-ids');
  if (idsEl) {
    idsEl.innerHTML =
      '<span>Session: ' + tracker.sessionId + '</span>' +
      '<span>Client: ' + tracker.clientId + '</span>';
  }

  addToEventLog('INFO', 'Tracker ready on ' + location.pathname, {
    application: 'relevaltech-html',
    sessionId: tracker.sessionId,
    clientId: tracker.clientId
  });
});
