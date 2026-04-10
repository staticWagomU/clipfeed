import type { ClipfeedConfig, FrontmatterMap, SiteMeta } from "./types.ts";

export type PartialClipfeedConfig = {
  input?: string;
  output?: string;
  limit?: number;
  site?: Partial<SiteMeta>;
  frontmatter?: Partial<FrontmatterMap>;
};

export const DEFAULT_CONFIG: ClipfeedConfig = {
  input: "./Clippings",
  output: "./feed.xml",
  limit: 5,
  site: {
    title: "My Clippings",
    description: "Recent web clippings",
    link: "https://example.com/",
    language: "en",
  },
  frontmatter: {
    title: "title",
    link: "source",
    description: "description",
    date: "created",
    author: "author",
  },
};

/**
 * Merge config sources with precedence: CLI flags > file config > defaults.
 * `site` and `frontmatter` are merged one level deep so partial overrides
 * don't clobber untouched keys.
 */
export function mergeConfig(
  file: PartialClipfeedConfig | undefined,
  cli: PartialClipfeedConfig,
): ClipfeedConfig {
  const f = file ?? {};
  return {
    input: cli.input ?? f.input ?? DEFAULT_CONFIG.input,
    output: cli.output ?? f.output ?? DEFAULT_CONFIG.output,
    limit: cli.limit ?? f.limit ?? DEFAULT_CONFIG.limit,
    site: {
      ...DEFAULT_CONFIG.site,
      ...f.site,
      ...cli.site,
    },
    frontmatter: {
      ...DEFAULT_CONFIG.frontmatter,
      ...f.frontmatter,
      ...cli.frontmatter,
    },
  };
}

/** Replace a leading `~` with the given home directory path. */
export function expandHome(path: string, home: string): string {
  if (path === "~") return home;
  if (path.startsWith("~/")) return home + path.slice(1);
  return path;
}

/** Load a JSON config file from disk. Returns undefined if the path is falsy. */
export async function loadConfigFile(
  path: string | undefined,
): Promise<PartialClipfeedConfig | undefined> {
  if (!path) return undefined;
  const text = await Deno.readTextFile(path);
  return JSON.parse(text) as PartialClipfeedConfig;
}
