// spamGuard.js

const ipRequestMap = new Map();
const REQUEST_LIMIT = 3;
const WINDOW_MINUTES = 30;

function isSpammy(ip, requestData = {}) {
  const now = Date.now();
  const windowMs = WINDOW_MINUTES * 60 * 1000;

  if (!ipRequestMap.has(ip)) {
    ipRequestMap.set(ip, { timestamps: [now], lastData: requestData });
    return false;
  }

  const record = ipRequestMap.get(ip);
  const recent = record.timestamps.filter(ts => now - ts <= windowMs);
  record.timestamps = recent;

  const isSameAsLast = JSON.stringify(record.lastData) === JSON.stringify(requestData);

  if (recent.length >= REQUEST_LIMIT && !isSameAsLast) {
    return true;
  }

  record.timestamps.push(now);
  record.lastData = requestData;
  return false;
}

module.exports = { isSpammy };
