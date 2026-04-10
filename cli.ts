import { parseArgs } from "@std/cli/parse-args";
import { join } from "@std/path";
import { ensure } from "@core/unknownutil";
import { parseClipping } from "./src/parseClipping.ts";
import { buildFeed } from "./src/buildFeed.ts";
import { renderRss } from "./src/renderRss.ts";
import { renderAtom } from "./src/renderAtom.ts";
import { renderJsonFeed } from "./src/renderJsonFeed.ts";
import {
  DEFAULT_CONFIG,
  expandHome,
  isDateSource,
  isFeedFormat,
  loadConfigFile,
  mergeConfig,
  type PartialClipfeedConfig,
} from "./src/config.ts";
import { uploadS3 } from "./src/upload/s3.ts";
import type { FeedItem } from "./src/types.ts";

const HELP = `clipfeed - build a feed from Markdown clippings (RSS / Atom / JSON Feed)

Usage:
  deno run -A cli.ts [options]

Options:
  --config <path>       Path to JSON config file
  --input <dir>         Directory containing clipping .md files
  --output <path>       Output path. Default depends on --format:
                        rss → ./feed.xml, atom → ./feed.atom.xml,
                        jsonfeed → ./feed.json
  --limit <n>           Max items in the feed (default: ${DEFAULT_CONFIG.limit})
  --format <fmt>        Feed format: rss | atom | jsonfeed (default: rss)
  --date-source <src>   Date source: filename | frontmatter | mtime (default: filename)
  --upload              Upload the generated feed using the 'upload' block
                        from the config file. The block selects the backend
                        (currently: S3-compatible — R2, S3, MinIO, B2, ...).
  --help, -h            Show this help

Credentials for upload are read from env vars named in the config's
'upload.accessKeyIdEnv' / 'upload.secretAccessKeyEnv' fields (defaults:
AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY).
`;

if (import.meta.main) {
  await main(Deno.args);
}

export async function main(args: string[]): Promise<void> {
  const flags = parseArgs(args, {
    string: ["config", "input", "output", "limit", "format", "date-source"],
    boolean: ["help", "upload"],
    alias: { h: "help" },
  });

  if (flags.help) {
    console.log(HELP);
    return;
  }

  const file = await loadConfigFile(flags.config);
  const cli = flagsToPartialConfig(flags);

  const config = mergeConfig(file, cli);
  const home = Deno.env.get("HOME") ?? "";
  const inputDir = expandHome(config.input, home);
  const outputPath = expandHome(config.output, home);

  const items = await readClippings(inputDir, config.frontmatter, config.dateSource);
  const top = buildFeed(items, config.limit);
  const body = renderFeed(top, config);

  await Deno.writeTextFile(outputPath, body);
  console.log(`clipfeed: wrote ${top.length} ${config.format} items to ${outputPath}`);

  if (flags.upload) {
    if (!config.upload) {
      throw new Error(
        `--upload was requested but no 'upload' block is present in the config file`,
      );
    }
    await runUpload(outputPath, config.upload);
  }
}

/**
 * Dispatch on the upload backend discriminator. Extracted so {@link main}
 * doesn't carry the variant-by-variant handling inline, and modeled on
 * {@link renderFeed}'s `switch`-on-`type` shape so the CLI has one consistent
 * dispatch style.
 *
 * Note: unlike `renderFeed`, this function returns `Promise<void>`, so TS
 * cannot detect a missed variant through "not all paths return a value".
 * The `default` branch therefore assigns `upload.type` to `never` to force a
 * build break when a new {@link UploadConfig} member is added without a handler.
 */
async function runUpload(
  outputPath: string,
  upload: NonNullable<ReturnType<typeof mergeConfig>["upload"]>,
): Promise<void> {
  switch (upload.type) {
    case "s3":
      await uploadS3(outputPath, upload);
      return;
    default: {
      const _never: never = upload.type;
      throw new Error(`Unknown upload type: ${_never}`);
    }
  }
}

/**
 * Shape of the subset of `parseArgs` output this CLI reads. Narrowing the
 * parameter type (instead of accepting the full `parseArgs` return value)
 * keeps {@link flagsToPartialConfig} trivially unit-testable with plain
 * object literals and decouples it from `@std/cli` internals.
 */
type CliFlagInput = {
  input?: string;
  output?: string;
  limit?: string;
  format?: string;
  "date-source"?: string;
};

/**
 * Project the raw CLI flag strings into a {@link PartialClipfeedConfig}.
 *
 * Only flags the user explicitly passed become keys on the result — a missing
 * flag stays absent so that `mergeConfig` can fall back to the file config or
 * the built-in defaults. We deliberately use `!== undefined` (not a truthy
 * check) to preserve that "user explicitly said so" semantics: an empty string
 * or `--limit 0` stays a user-provided value rather than being silently merged
 * away.
 *
 * `format` and `date-source` are validated through `ensure` + the predicates
 * re-exported from `config.ts`, so unknown values fail fast with a structured
 * `AssertError` from `@core/unknownutil` instead of hand-rolled error strings.
 */
function flagsToPartialConfig(flags: CliFlagInput): PartialClipfeedConfig {
  const cli: PartialClipfeedConfig = {};
  if (flags.input !== undefined) cli.input = flags.input;
  if (flags.output !== undefined) cli.output = flags.output;
  if (flags.limit !== undefined) cli.limit = Number(flags.limit);
  if (flags.format !== undefined) {
    cli.format = ensure(flags.format, isFeedFormat, {
      message: `--format must be one of: rss, atom, jsonfeed`,
    });
  }
  if (flags["date-source"] !== undefined) {
    cli.dateSource = ensure(flags["date-source"], isDateSource, {
      message: `--date-source must be one of: filename, frontmatter, mtime`,
    });
  }
  return cli;
}

function renderFeed(
  items: FeedItem[],
  config: ReturnType<typeof mergeConfig>,
): string {
  switch (config.format) {
    case "rss":
      return renderRss(items, config.site);
    case "atom":
      return renderAtom(items, config.site);
    case "jsonfeed":
      return renderJsonFeed(items, config.site);
  }
}

async function readClippings(
  inputDir: string,
  map: typeof DEFAULT_CONFIG.frontmatter,
  dateSource: typeof DEFAULT_CONFIG.dateSource,
): Promise<FeedItem[]> {
  const items: FeedItem[] = [];
  for await (const entry of Deno.readDir(inputDir)) {
    if (!entry.isFile || !entry.name.endsWith(".md")) continue;
    const path = join(inputDir, entry.name);
    try {
      const content = await Deno.readTextFile(path);
      // Only stat the file when the strategy actually needs mtime, to avoid wasted I/O.
      const mtime = dateSource === "mtime" ? (await Deno.stat(path)).mtime ?? undefined : undefined;
      items.push(parseClipping(entry.name, content, map, { dateSource, mtime }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`clipfeed: skipping ${entry.name}: ${msg}`);
    }
  }
  return items;
}
