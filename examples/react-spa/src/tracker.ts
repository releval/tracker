import {
  ConsoleLogger,
  ConsoleSink,
  Enricher,
  Logger,
  Sink,
  Tracker,
} from '@releval/tracker';

// ================================================================
// Event Log System (observable from React components)
// ================================================================

export type EventLogEntry = {
  type: 'EVENT' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  message: string;
  timestamp: Date;
  data: unknown;
};

type Listener = (entries: EventLogEntry[]) => void;

let eventLog: EventLogEntry[] = [];
let listeners: Listener[] = [];

function notify() {
  const snapshot = [...eventLog];
  listeners.forEach(l => l(snapshot));
}

export function subscribeToEventLog(listener: Listener): () => void {
  listeners.push(listener);
  return () => { listeners = listeners.filter(l => l !== listener); };
}

export function clearEventLog() {
  eventLog = [];
  notify();
}

function addLogEntry(type: EventLogEntry['type'], message: string, data: unknown) {
  eventLog.push({ type, message, timestamp: new Date(), data });
  notify();
}

// ================================================================
// Example-only extras: a sink that feeds the visual panel, a fan-out
// logger, and an enricher that stamps store metadata on every event.
// ================================================================

class EventLogSink implements Sink {
  emit(event: any): void {
    addLogEntry('EVENT', event.action_name || 'unknown', event);
  }
}

const storeEnricher: Enricher = {
  enrich(event) {
    if (!event.event_attributes) event.event_attributes = {};
    event.event_attributes.store = { name: 'RelevalTech', channel: 'web-spa', version: '1.0' };
  }
};

// The tracker's DEBUG diagnostics (every dispatched event, delivery
// outcomes) are noisy, so they are off by default. Set this to true to
// see them in the console and the event log panel.
const SHOW_DEBUG_LOGS = false;

const consoleLogger = new ConsoleLogger({ verbose: true });

const panelLogger: Logger = {
  debug(msg: string, ...data: unknown[]) { addLogEntry('DEBUG', msg, data); },
  info(msg: string, ...data: unknown[])  { addLogEntry('INFO', msg, data); },
  warn(msg: string, ...data: unknown[])  { addLogEntry('WARN', msg, data); },
  error(msg: string, ...data: unknown[]) { addLogEntry('ERROR', msg, data); },
};

// The logger is fixed at construction, so fan-out to several destinations is
// a plain wrapper passed as the `logger` option (see main.tsx). The default
// ConsoleLogger stays in the mix because it is the only visible feedback in
// the pipeline - the server answers 202 to everything.
export const trackerLogger: Logger = {
  debug(msg: string, ...data: unknown[]) {
    if (SHOW_DEBUG_LOGS) { consoleLogger.debug(msg, ...data); panelLogger.debug(msg, ...data); }
  },
  info(msg: string, ...data: unknown[])  { consoleLogger.info(msg, ...data);  panelLogger.info(msg, ...data); },
  warn(msg: string, ...data: unknown[])  { consoleLogger.warn(msg, ...data);  panelLogger.warn(msg, ...data); },
  error(msg: string, ...data: unknown[]) { consoleLogger.error(msg, ...data); panelLogger.error(msg, ...data); },
};

// ================================================================
// One-time tracker wiring. Passed to <TrackerProvider onInit={...}> so it runs
// once, before start(). The provider owns the start()/stop() lifecycle, so
// nothing here is a module singleton and no page manages the tracker's
// lifetime. Result clicks, impressions and conversions need no wiring at all:
// components use the library's high-level API and hooks directly.
// ================================================================

export function setupTracking(tracker: Tracker) {
  // Sinks: the console, plus the on-screen Event Log panel.
  tracker.addSink(new ConsoleSink());
  tracker.addSink(new EventLogSink());
  // Stamp store metadata onto every event.
  tracker.addEnricher(storeEnricher);
}
