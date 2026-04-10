import { parseArgs } from "@std/cli/parse-args";
import { join } from "@std/path";
import { parseClipping } from "./src/parseClipping.ts";
import { buildFeed } from "./src/buildFeed.ts";
import { renderRss } from "./src/renderRss.ts";
import {
  DEFAULT_CONFIG,
  expandHome,
  loadConfigFile,
  mergeConfig,
  type PartialClipfeedConfig,
} from "./src/config.ts";
import { uploadToR2 } from "./src/uploadR2.ts";
import type { FeedItem } from "./src/types.ts";

const HELP = `clipfeed - build an RSS feed from Obsidian Web Clipper markdown files

Usage:
  deno run -A cli.ts [options]

Options:
  --config <path>       Path to JSON config file
  --input <dir>         Directory containing clipping .md files
  --output <path>       Output path for the generated feed.xml (default: ./feed.xml)
  --limit <n>           Maximum number of items in the feed (default: ${DEFAULT_CONFIG.limit})
  --upload <target>     Upload destination: "r2" (uses S3 API + env vars)
  --help, -h            Show this help

Environment variables (when --upload r2):
  R2_ACCOUNT_ID         Cloudflare account ID
  R2_ACCESS_KEY_ID      R2 S3 API access key
  R2_SECRET_ACCESS_KEY  R2 S3 API secret key
  R2_BUCKET             R2 bucket name
  R2_OBJECT_KEY         Object key in the bucket (default: feed.xml)
`;

if (import.meta.main) {
  await main(Deno.args);
}

export async function main(args: string[]): Promise<void> {
  const flags = parseArgs(args, {
    string: ["config", "input", "output", "limit", "upload"],
    boolean: ["help"],
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

  const config = mergeConfig(file, cli);
  const home = Deno.env.get("HOME") ?? "";
  const inputDir = expandHome(config.input, home);
  const outputPath = expandHome(config.output, home);

  const items = await readClippings(inputDir, config.frontmatter);
  const top = buildFeed(items, config.limit);
  const xml = renderRss(top, config.site);

  await Deno.writeTextFile(outputPath, xml);
  console.log(`clipfeed: wrote ${top.length} items to ${outputPath}`);

  if (flags.upload === "r2") {
    await uploadToR2(outputPath);
  }
}

async function readClippings(
  inputDir: string,
  map: typeof DEFAULT_CONFIG.frontmatter,
): Promise<FeedItem[]> {
  const items: FeedItem[] = [];
  for await (const entry of Deno.readDir(inputDir)) {
    if (!entry.isFile || !entry.name.endsWith(".md")) continue;
    const path = join(inputDir, entry.name);
    try {
      const content = await Deno.readTextFile(path);
      items.push(parseClipping(entry.name, content, map));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`clipfeed: skipping ${entry.name}: ${msg}`);
    }
  }
  return items;
}
