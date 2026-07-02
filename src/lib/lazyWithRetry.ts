import { lazy, type ComponentType, type LazyExoticComponent } from "react";

const RETRY_PREFIX = "__lazy_chunk_retry__";
const CHUNK_ERROR_MARKERS = [
  "Failed to fetch dynamically imported module",
  "Importing a module script failed",
  "error loading dynamically imported module",
  "ChunkLoadError",
  "Loading chunk",
];

const isChunkLoadError = (error: unknown): boolean => {
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : "";

  return CHUNK_ERROR_MARKERS.some((marker) => message.includes(marker));
};

export function lazyWithRetry<T extends ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
  key?: string,
): LazyExoticComponent<T> {
  return lazy(async () => {
    const retryKey = `${RETRY_PREFIX}:${key ?? importer.toString()}`;

    try {
      const module = await importer();
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(retryKey);
      }
      return module;
    } catch (error) {
      if (typeof window !== "undefined" && isChunkLoadError(error)) {
        const retryCount = parseInt(sessionStorage.getItem(retryKey) || "0", 10);

        // Allow up to 2 retries (handles cases where first reload still hits stale cache)
        if (retryCount < 2) {
          sessionStorage.setItem(retryKey, String(retryCount + 1));

          try {
            if ("serviceWorker" in navigator) {
              const registrations = await navigator.serviceWorker.getRegistrations();
              await Promise.all(
                registrations.map((registration) =>
                  registration.unregister().catch(() => false),
                ),
              );
            }

            if ("caches" in window) {
              const cacheKeys = await caches.keys();
              await Promise.all(
                cacheKeys.map((cacheKey) => caches.delete(cacheKey).catch(() => false)),
              );
            }
          } catch {
            // no-op
          }

          const nextUrl = new URL(window.location.href);
          nextUrl.searchParams.set("__cb", String(Date.now()));
          window.location.replace(nextUrl.toString());

          return new Promise<{ default: T }>(() => {
            // Intentionally pending while browser navigates
          });
        }
      }

      throw error;
    }
  });
}