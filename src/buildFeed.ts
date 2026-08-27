import type { FeedItem } from "./types.ts";

/**
 * Sort FeedItems by pubDate descending (newest first) and return the first `limit` entries.
 *
 * - Non-mutating: returns a new array; the input is untouched.
 * - Deterministic: ties on pubDate are broken by guid ascending, so identical inputs
 *   always produce identical output (important for idempotent feed.xml builds in CI).
 * - De-duplicated by link: re-clipping the same URL yields multiple files (distinct
 *   guids) pointing at one article. We collapse those to the newest copy so the feed
 *   never shows the same link twice. Dedup runs before `slice` so a redundant copy
 *   can't consume a slot and push a genuinely distinct article out of a limited feed.
 *   Items with an empty link are left untouched — they are not all "the same URL".
 * - Rejects invalid pubDates: an Invalid Date makes the comparator return NaN, which
 *   leaves the sort order — and therefore which duplicate survives dedup — up to the
 *   engine. The parse layer already guards every date source, so this only fires on a
 *   programming error; failing fast beats silently emitting a nondeterministic feed.
 */
export function buildFeed(items: readonly FeedItem[], limit: number): FeedItem[] {
  for (const item of items) {
    if (isNaN(item.pubDate.getTime())) {
      throw new Error(`buildFeed: invalid pubDate on item "${item.guid}"`);
    }
  }

  const sortedNewestFirst = [...items].sort((a, b) => {
    const diff = b.pubDate.getTime() - a.pubDate.getTime();
    if (diff !== 0) return diff;
    return a.guid < b.guid ? -1 : a.guid > b.guid ? 1 : 0;
  });

  const seenLinks = new Set<string>();
  const deduped: FeedItem[] = [];
  for (const item of sortedNewestFirst) {
    if (item.link) {
      if (seenLinks.has(item.link)) continue;
      seenLinks.add(item.link);
    }
    deduped.push(item);
  }

  return deduped.slice(0, limit);
}
