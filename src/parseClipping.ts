import { parse as parseYaml } from "@std/yaml";
import { parseFilename } from "./parseFilename.ts";
import { preprocessFrontmatter } from "./preprocessFrontmatter.ts";
import { resolveDate } from "./resolveDate.ts";
import type { DateSource, FeedItem, FrontmatterMap } from "./types.ts";

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export type ParseClippingOptions = {
  dateSource: DateSource;
  /** File mtime, required only when dateSource === "mtime". */
  mtime?: Date;
};

/**
 * Parse a single clipping file into a FeedItem.
 *
 * The `map` argument declares which frontmatter keys supply each FeedItem field,
 * so users with customized templates can remap without code changes.
 * The `opts.dateSource` strategy determines which date is used for pubDate.
 */
export function parseClipping(
  filename: string,
  content: string,
  map: FrontmatterMap,
  opts: ParseClippingOptions = { dateSource: "filename" },
): FeedItem {
  const match = FRONTMATTER_RE.exec(content);
  if (!match) {
    throw new Error(`parseClipping: frontmatter not found in "${filename}"`);
  }

  const fm = parseYaml(preprocessFrontmatter(match[1])) as Record<string, unknown> | null;
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

  const parsedName = tryParseFilename(filename);
  const frontmatterDate = pickDate(fm, map.date);

  const pubDate = resolveDate(opts.dateSource, {
    filenameTimestamp: parsedName?.timestamp,
    frontmatterDate,
    mtime: opts.mtime,
  });

  const guid = parsedName?.stem ?? filename.replace(/\.md$/, "");

  return { title, link, description, pubDate, guid, author };
}

/** Non-throwing wrapper around parseFilename — files without a timestamp prefix are allowed. */
function tryParseFilename(filename: string) {
  try {
    return parseFilename(filename);
  } catch {
    return undefined;
  }
}

function pickDate(fm: Record<string, unknown>, key: string): Date | undefined {
  const v = fm[key];
  if (v instanceof Date) return v;
  if (typeof v === "string" && v.trim()) {
    const d = new Date(v);
    return isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
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
