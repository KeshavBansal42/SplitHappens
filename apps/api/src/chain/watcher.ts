import { logger } from "../logger.js";

export interface WatcherHandle {
  stop: () => Promise<void>;
}

export function startWatcher(
  name: string,
  intervalMs: number,
  tick: () => Promise<void>,
): WatcherHandle {
  let running = false;
  let stopped = false;
  let inFlight: Promise<void> = Promise.resolve();
  let timer: NodeJS.Timeout | undefined;

  const run = async (): Promise<void> => {
    if (running || stopped) return;
    running = true;
    try {
      await tick();
    } catch (err) {
      logger.error({ err, watcher: name }, "watcher tick failed");
    } finally {
      running = false;
    }
  };

  const loop = (): void => {
    if (stopped) return;
    inFlight = run();
    timer = setTimeout(loop, intervalMs);
    timer.unref?.();
  };

  loop();

  return {
    async stop(): Promise<void> {
      stopped = true;
      if (timer) clearTimeout(timer);
      await inFlight;
    },
  };
}
