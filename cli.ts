import { parseArgs } from "@std/cli/parse-args";
import { join } from "@std/path";
import { parseClipping } from "./src/parseClipping.ts";
import { buildFeed } from "./src/buildFeed.ts";
import { renderRss } from "./src/renderRss.ts";
import { renderAtom } from "./src/renderAtom.ts";
import { renderJsonFeed } from "./src/renderJsonFeed.ts";
import {
  DEFAULT_CONFIG,
  expandHome,
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
  --output <path>       Output path (default: ./feed.xml)
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
  const cli: PartialClipfeedConfig = {};
  if (flags.input) cli.input = flags.input;
  if (flags.output) cli.output = flags.output;
  if (flags.limit) cli.limit = Number(flags.limit);
  if (flags.format) cli.format = assertFormat(flags.format);
  if (flags["date-source"]) cli.dateSource = assertDateSource(flags["date-source"]);

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
    if (config.upload.type === "s3") {
      await uploadS3(outputPath, config.upload);
    } else {
      // exhaustiveness check: compile error here if a new UploadConfig variant is added
      const _never: never = config.upload.type;
      throw new Error(`Unknown upload type: ${_never}`);
    }
  }
}

function assertFormat(v: string): "rss" | "atom" | "jsonfeed" {
  if (v === "rss" || v === "atom" || v === "jsonfeed") return v;
  throw new Error(`--format must be one of: rss, atom, jsonfeed (got "${v}")`);
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

function assertDateSource(v: string): "filename" | "frontmatter" | "mtime" {
  if (v === "filename" || v === "frontmatter" || v === "mtime") return v;
  throw new Error(`--date-source must be one of: filename, frontmatter, mtime (got "${v}")`);
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
