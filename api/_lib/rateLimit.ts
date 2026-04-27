type RateLimitOptions = {
  limit: number;
  windowMs: number;
};

type RateLimitState = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitState>();

function now() {
  return Date.now();
}

function pruneExpiredBuckets(currentTime: number) {
  for (const [key, value] of buckets.entries()) {
    if (value.resetAt <= currentTime) {
      buckets.delete(key);
    }
  }
}

export class RateLimitError extends Error {
  retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("Muitas tentativas. Tente novamente em instantes.");
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function assertRateLimit(key: string, options: RateLimitOptions) {
  const currentTime = now();
  pruneExpiredBuckets(currentTime);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= currentTime) {
    buckets.set(key, {
      count: 1,
      resetAt: currentTime + options.windowMs,
    });
    return;
  }

  if (existing.count >= options.limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - currentTime) / 1000));
    throw new RateLimitError(retryAfterSeconds);
  }

  existing.count += 1;
  buckets.set(key, existing);
}

export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError;
}
