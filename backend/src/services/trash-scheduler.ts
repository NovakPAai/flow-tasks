import { purgeExpired } from '../modules/workspaces/workspaces.service.js';
import { logger } from '../shared/utils/logger.js';

const PURGE_INTERVAL_MS = 60 * 60 * 1000; // hourly

let timer: ReturnType<typeof setInterval> | null = null;

async function runOnce(): Promise<void> {
  try {
    const { purged, ids } = await purgeExpired();
    if (purged > 0) logger.info('trash_purge_completed', { purged, ids });
  } catch (err: unknown) {
    logger.error('trash_purge_failed', { error: String(err) });
  }
}

export function startTrashScheduler(): void {
  if (timer) return;
  void runOnce();
  timer = setInterval(() => { void runOnce(); }, PURGE_INTERVAL_MS);
  // Allow Node to exit if this is the only outstanding timer (esp. for integration tests).
  timer.unref?.();
}

export function stopTrashScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
