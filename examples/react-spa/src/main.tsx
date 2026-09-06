import React from 'react';
import ReactDOM from 'react-dom/client';
import { TrackerProvider } from '@releval/tracker/react';
import { App } from './App';
import { setupTracking, trackerLogger } from './tracker';

// The provider constructs the tracker, runs setupTracking() once (sinks and
// the store enricher), starts it on mount, and stops it on unmount.
// Components read the instance with useTracker(). The logger fans out to the
// console AND the on-page event log panel; it is fixed at construction, so it
// travels as an option rather than as onInit wiring.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TrackerProvider
      options={{ application: 'relevaltech-react-spa', logger: trackerLogger }}
      onInit={setupTracking}
    >
      <App />
    </TrackerProvider>
  </React.StrictMode>
);
