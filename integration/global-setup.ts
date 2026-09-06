import { startHarness, writeHarnessInfo } from "./harness";

/**
 * Boots the Releval stack once for the whole integration run and records the
 * connection info (app URL, ClickHouse URL, siteId, server-issued query_id) to
 * a file the specs read.
 */
export default async function globalSetup(): Promise<void> {
  const info = await startHarness();
  writeHarnessInfo(info);
}
