// spamGuard.js

const RATE_LIMIT_WINDOW_MINUTES = 10;
const MAX_REQUESTS_PER_WINDOW = 3;

const ipCache = {}; // In-memory cache (resets when function reloads)

function isRateLimitExceeded(ip) {
  const now = Date.now();
  const windowMs = RATE_LIMIT_WINDOW_MINUTES * 60 * 1000;

  if (!ipCache[ip]) {
    ipCache[ip] = [];
  }

  // Keep only timestamps within the last X minutes
  ipCache[ip] = ipCache[ip].filter(ts => now - ts < windowMs);

  // Log this new request attempt
  ipCache[ip].push(now);

  console.log(`🛡️ IP ${ip} has ${ipCache[ip].length} requests in the last ${RATE_LIMIT_WINDOW_MINUTES} min.`);

  // ✅ For now, do NOT block. Just logging.
  return false;
}

module.exports = { isRateLimitExceeded };
