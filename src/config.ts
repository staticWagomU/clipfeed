import { as, ensure, is } from "@core/unknownutil";
import type {
  ClipfeedConfig,
  DateSource,
  FeedFormat,
  FrontmatterMap,
  SiteMeta,
  UploadConfig,
} from "./types.ts";

export type PartialClipfeedConfig = {
  input?: string;
  output?: string;
  limit?: number;
  format?: FeedFormat;
  dateSource?: DateSource;
  site?: Partial<SiteMeta>;
  frontmatter?: Partial<FrontmatterMap>;
  upload?: UploadConfig;
};

/** Runtime-checkable predicate for {@link FeedFormat}. Reused by the CLI flag parser. */
export const isFeedFormat = is.LiteralOneOf(
  ["rss", "atom", "jsonfeed"],
) satisfies (x: unknown) => x is FeedFormat;

/** Runtime-checkable predicate for {@link DateSource}. Reused by the CLI flag parser. */
export const isDateSource = is.LiteralOneOf(
  ["filename", "frontmatter", "mtime"],
) satisfies (x: unknown) => x is DateSource;

const isPartialSiteMeta = is.ObjectOf({
  title: as.Optional(is.String),
  description: as.Optional(is.String),
  link: as.Optional(is.String),
  language: as.Optional(is.String),
}) satisfies (x: unknown) => x is Partial<SiteMeta>;

const isPartialFrontmatterMap = is.ObjectOf({
  title: as.Optional(is.String),
  link: as.Optional(is.String),
  description: as.Optional(is.String),
  date: as.Optional(is.String),
  author: as.Optional(is.String),
}) satisfies (x: unknown) => x is Partial<FrontmatterMap>;

const isUploadConfig = is.ObjectOf({
  type: is.LiteralOf("s3"),
  endpoint: is.String,
  region: is.String,
  bucket: is.String,
  objectKey: is.String,
  accessKeyIdEnv: as.Optional(is.String),
  secretAccessKeyEnv: as.Optional(is.String),
  useSSL: as.Optional(is.Boolean),
}) satisfies (x: unknown) => x is UploadConfig;

/**
 * Runtime schema for {@link PartialClipfeedConfig}. Used to validate JSON
 * loaded from disk so `loadConfigFile` doesn't have to rely on an unchecked
 * `as` cast. The `satisfies` clause below guarantees at compile time that
 * this predicate produces a type assignable to {@link PartialClipfeedConfig};
 * if the two drift apart, the build breaks here rather than silently at runtime.
 */
export const isPartialClipfeedConfig = is.ObjectOf({
  input: as.Optional(is.String),
  output: as.Optional(is.String),
  limit: as.Optional(is.Number),
  format: as.Optional(isFeedFormat),
  dateSource: as.Optional(isDateSource),
  site: as.Optional(isPartialSiteMeta),
  frontmatter: as.Optional(isPartialFrontmatterMap),
  upload: as.Optional(isUploadConfig),
}) satisfies (x: unknown) => x is PartialClipfeedConfig;

export const DEFAULT_CONFIG: ClipfeedConfig = {
  input: "./Clippings",
  output: "./feed.xml",
  limit: 5,
  format: "rss",
  dateSource: "filename",
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
 *
 * `output` is special: if the user did not pick one anywhere, we derive a
 * sensible default from the final `format` (see {@link defaultOutputForFormat})
 * so `--format atom` doesn't silently write Atom XML into `./feed.xml`.
 */
export function mergeConfig(
  file: PartialClipfeedConfig | undefined,
  cli: PartialClipfeedConfig,
): ClipfeedConfig {
  const f = file ?? {};
  const format = cli.format ?? f.format ?? DEFAULT_CONFIG.format;
  return {
    input: cli.input ?? f.input ?? DEFAULT_CONFIG.input,
    output: cli.output ?? f.output ?? defaultOutputForFormat(format),
    limit: cli.limit ?? f.limit ?? DEFAULT_CONFIG.limit,
    format,
    dateSource: cli.dateSource ?? f.dateSource ?? DEFAULT_CONFIG.dateSource,
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
    upload: cli.upload ?? f.upload,
  };
}

/**
 * Default output path per feed format. Picked only when neither the CLI nor
 * the config file names an explicit `output`. Keeping the mapping here (not
 * in `DEFAULT_CONFIG`) lets `DEFAULT_CONFIG.output` stay as the legacy
 * `./feed.xml` literal for any callers that read it directly.
 */
export function defaultOutputForFormat(format: FeedFormat): string {
  switch (format) {
    case "rss":
      return "./feed.xml";
    case "atom":
      return "./feed.atom.xml";
    case "jsonfeed":
      return "./feed.json";
  }
}

/** Replace a leading `~` with the given home directory path. */
export function expandHome(path: string, home: string): string {
  if (path === "~") return home;
  if (path.startsWith("~/")) return home + path.slice(1);
  return path;
}

/**
 * Load a JSON config file from disk. Returns undefined if the path is falsy.
 *
 * The parsed JSON is validated against {@link isPartialClipfeedConfig} via
 * `ensure`, so a malformed config fails fast with an `AssertError` pointing at
 * the offending field instead of propagating untyped garbage into `mergeConfig`.
 */
export async function loadConfigFile(
  path: string | undefined,
): Promise<PartialClipfeedConfig | undefined> {
  if (!path) return undefined;
  const text = await Deno.readTextFile(path);
  return ensure(JSON.parse(text), isPartialClipfeedConfig, {
    message: `Invalid config file: ${path}`,
  });
}
