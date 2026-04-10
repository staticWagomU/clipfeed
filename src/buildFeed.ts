import type { FeedItem } from "./types.ts";

/**
 * Sort FeedItems by pubDate descending (newest first) and return the first `limit` entries.
 *
 * - Non-mutating: returns a new array; the input is untouched.
 * - Deterministic: ties on pubDate are broken by guid ascending, so identical inputs
 *   always produce identical output (important for idempotent feed.xml builds in CI).
 */
export function buildFeed(items: readonly FeedItem[], limit: number): FeedItem[] {
  return [...items]
    .sort((a, b) => {
      const diff = b.pubDate.getTime() - a.pubDate.getTime();
      if (diff !== 0) return diff;
      return a.guid < b.guid ? -1 : a.guid > b.guid ? 1 : 0;
    })
    .slice(0, limit);
}
