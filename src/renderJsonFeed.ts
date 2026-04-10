import type { FeedItem, SiteMeta } from "./types.ts";
import { joinUrl } from "./xml.ts";

type JsonFeedAuthor = { name: string };

type JsonFeedItem = {
  id: string;
  url: string;
  title: string;
  content_text: string;
  date_published: string;
  authors?: JsonFeedAuthor[];
};

type JsonFeedDocument = {
  version: "https://jsonfeed.org/version/1.1";
  title: string;
  description?: string;
  home_page_url?: string;
  feed_url?: string;
  language?: string;
  items: JsonFeedItem[];
};

/**
 * Render a list of FeedItems as JSON Feed 1.1 (https://jsonfeed.org/version/1.1).
 *
 * - date_published is ISO 8601.
 * - author is promoted to the 1.1-style `authors` array.
 * - No XML escaping is needed; JSON.stringify handles encoding.
 */
export function renderJsonFeed(items: readonly FeedItem[], site: SiteMeta): string {
  const doc: JsonFeedDocument = {
    version: "https://jsonfeed.org/version/1.1",
    title: site.title,
    description: site.description,
    home_page_url: site.link,
    feed_url: joinUrl(site.link, "feed.json"),
    language: site.language,
    items: items.map((i) => {
      const item: JsonFeedItem = {
        id: i.guid,
        url: i.link,
        title: i.title,
        content_text: i.description,
        date_published: i.pubDate.toISOString(),
      };
      if (i.author) {
        item.authors = [{ name: i.author }];
      }
      return item;
    }),
  };
  return JSON.stringify(doc, null, 2) + "\n";
}
