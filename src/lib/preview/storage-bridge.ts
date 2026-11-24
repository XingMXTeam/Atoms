export const PREVIEW_STORAGE_LIMIT_BYTES = 64 * 1024;
export const MAX_PREVIEW_STORAGE_KEYS = 100;

export type PreviewStorageMessage = {
  source: "atoms-preview";
  type: "storage";
  state: Record<string, string>;
};

/** Sanitize untrusted preview KV state into a bounded Record<string, string>. */
export function sanitizePreviewState(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const result: Record<string, string> = {};
  let keys = 0;
  let totalBytes = 2; // `{}`

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (keys >= MAX_PREVIEW_STORAGE_KEYS) break;
    if (typeof key !== "string" || key.length === 0 || key.length > 256) continue;
    if (typeof value !== "string") continue;
    const entryBytes = key.length + value.length + 6;
    if (totalBytes + entryBytes > PREVIEW_STORAGE_LIMIT_BYTES) continue;
    result[key] = value;
    totalBytes += entryBytes;
    keys += 1;
  }

  return result;
}

/** Validate a `postMessage` storage sync event from the active preview iframe. */
export function isPreviewStorageMessage(
  event: MessageEvent,
  expectedSource: MessageEventSource | null | undefined,
): Record<string, string> | null {
  if (expectedSource && event.source !== expectedSource) return null;
  const data = event.data;
  if (!data || typeof data !== "object") return null;
  const msg = data as Partial<PreviewStorageMessage>;
  if (msg.source !== "atoms-preview" || msg.type !== "storage") return null;
  if (!msg.state || typeof msg.state !== "object" || Array.isArray(msg.state)) {
    return null;
  }
  return sanitizePreviewState(msg.state);
}

/**
 * Injects a safe, synchronous Storage proxy on `window.localStorage` and
 * `window.sessionStorage` inside opaque-origin (`sandbox="allow-scripts allow-forms"`)
 * preview iframes, mirroring writes back to the host via `postMessage`.
 */
export function buildPreviewStorageShim(
  initialState: Record<string, string> = {},
): string {
  const safeInitial = sanitizePreviewState(initialState);
  const serialized = JSON.stringify(safeInitial).replace(/<\/script/gi, "<\\/script");

  return `(function(){
  try {
    var MAX_KEYS = ${MAX_PREVIEW_STORAGE_KEYS};
    var MAX_BYTES = ${PREVIEW_STORAGE_LIMIT_BYTES};
    var store = Object.create(null);
    var seed = ${serialized};
    for (var k in seed) {
      if (Object.prototype.hasOwnProperty.call(seed, k)) {
        store[k] = String(seed[k]);
      }
    }
    var notify = function() {
      try {
        var copy = {};
        var count = 0;
        var bytes = 2;
        for (var key in store) {
          if (count >= MAX_KEYS) break;
          var val = store[key];
          var add = key.length + val.length + 6;
          if (bytes + add > MAX_BYTES) break;
          copy[key] = val;
          bytes += add;
          count += 1;
        }
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ source: "atoms-preview", type: "storage", state: copy }, "*");
        }
      } catch (e) {}
    };
    var createShim = function(persist) {
      var mem = persist ? store : Object.create(null);
      return {
        get length() { return Object.keys(mem).length; },
        key: function(index) {
          var keys = Object.keys(mem);
          return index >= 0 && index < keys.length ? keys[index] : null;
        },
        getItem: function(key) {
          var k = String(key);
          return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null;
        },
        setItem: function(key, value) {
          var k = String(key);
          var v = String(value);
          if (k.length > 256 || v.length > MAX_BYTES) return;
          if (!Object.prototype.hasOwnProperty.call(mem, k) && Object.keys(mem).length >= MAX_KEYS) return;
          mem[k] = v;
          if (persist) notify();
        },
        removeItem: function(key) {
          var k = String(key);
          if (Object.prototype.hasOwnProperty.call(mem, k)) {
            delete mem[k];
            if (persist) notify();
          }
        },
        clear: function() {
          for (var key in mem) delete mem[key];
          if (persist) notify();
        }
      };
    };
    var localShim = createShim(true);
    var sessionShim = createShim(false);
    try {
      Object.defineProperty(window, "localStorage", { configurable: true, enumerable: true, get: function() { return localShim; } });
    } catch (e) {}
    try {
      Object.defineProperty(window, "sessionStorage", { configurable: true, enumerable: true, get: function() { return sessionShim; } });
    } catch (e) {}
  } catch (e) {}
})();`;
}
