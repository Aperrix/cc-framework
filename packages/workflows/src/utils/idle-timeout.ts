/**
 * Async operation idle timeout utility.
 *
 * Wraps a promise with a timeout — if the operation doesn't complete
 * within `timeoutMs`, it rejects with an IdleTimeoutError.
 *
 * Primary defense against hung AI processes where the subprocess
 * completes its work but fails to exit (stuck MCP connection,
 * dangling child process, etc.).
 */

/** Default idle timeout: 30 minutes. Generous enough for legitimate work. */
export const DEFAULT_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export class IdleTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Operation timed out after ${Math.floor(timeoutMs / 1000)}s of inactivity`);
    this.name = "IdleTimeoutError";
  }
}

/**
 * Wrap a promise with an idle timeout.
 * If the promise doesn't resolve/reject within `timeoutMs`, rejects with IdleTimeoutError.
 *
 * @param operation - The promise to wrap
 * @param timeoutMs - Maximum idle time in milliseconds
 * @param onTimeout - Optional callback invoked when timeout fires (e.g. to abort subprocess)
 */
export async function withIdleTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number = DEFAULT_IDLE_TIMEOUT_MS,
  onTimeout?: () => void,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      onTimeout?.();
      reject(new IdleTimeoutError(timeoutMs));
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
