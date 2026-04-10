import { parse as parseYaml } from "@std/yaml";
import { parseFilename } from "./parseFilename.ts";
import type { FeedItem, FrontmatterMap } from "./types.ts";

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/**
 * Parse a single clipping file (Obsidian Web Clipper style) into a FeedItem.
 *
 * The `map` argument declares which frontmatter keys supply each FeedItem field,
 * so users with customized Web Clipper templates can remap without code changes.
 */
export function parseClipping(
  filename: string,
  content: string,
  map: FrontmatterMap,
): FeedItem {
  const match = FRONTMATTER_RE.exec(content);
  if (!match) {
    throw new Error(`parseClipping: frontmatter not found in "${filename}"`);
  }

  const fm = parseYaml(match[1]) as Record<string, unknown> | null;
  if (!fm || typeof fm !== "object") {
    throw new Error(`parseClipping: frontmatter is empty or invalid in "${filename}"`);
  }

  const title = pickString(fm, map.title);
  if (!title) {
    throw new Error(`parseClipping: missing "${map.title}" (title) in "${filename}"`);
  }

  const link = pickString(fm, map.link) ?? "";
  const description = pickString(fm, map.description) ?? "";
  const author = stripWikiLinks(pickString(fm, map.author));

  const parsedName = parseFilename(filename);
  // Filename timestamp is preferred because it carries seconds-level precision,
  // while frontmatter `created` is typically a date-only value (midnight UTC)
  // in Obsidian Web Clipper templates. This keeps chronological ordering stable.
  const pubDate = parsedName.timestamp;

  return {
    title,
    link,
    description,
    pubDate,
    guid: parsedName.stem,
    author,
  };
}

function pickString(fm: Record<string, unknown>, key: string): string | undefined {
  const v = fm[key];
  if (typeof v === "string") return v.trim() || undefined;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0].trim() || undefined;
  return undefined;
}

function stripWikiLinks(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.replace(/^\[\[(.+)\]\]$/, "$1");
}
