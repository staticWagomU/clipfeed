# clipfeed

Build an RSS 2.0 feed from [Obsidian Web Clipper](https://obsidian.md/clipper) markdown files, with
optional upload to Cloudflare R2.

- Reads a directory of `YYYYMMDDHHmmss-<title>.md` clippings
- Parses YAML frontmatter (`title` / `source` / `description` / `author`)
- Generates `feed.xml` (RSS 2.0, RFC 822 pubDate, XML-escaped)
- Optional upload to R2 via the S3-compatible API (no `wrangler` required)
- Configurable via JSON config file + CLI flags
- Built on Deno — no `npm install`, no `node_modules`

## Install

Requires [Deno](https://deno.com) 2.x. No install step — run directly from source:

```sh
git clone https://github.com/staticWagomU/clipfeed.git
cd clipfeed
deno task test
```

## Usage

### Quick start

```sh
deno run -A cli.ts \
  --input ~/MyLife/Clippings \
  --output ./feed.xml \
  --limit 5
```

### With a config file

```sh
deno run -A cli.ts --config feed.config.json
```

See [`examples/feed.config.json`](./examples/feed.config.json) for a full example.

### Upload to Cloudflare R2

```sh
export R2_ACCOUNT_ID="..."
export R2_ACCESS_KEY_ID="..."
export R2_SECRET_ACCESS_KEY="..."
export R2_BUCKET="my-feed-bucket"
# optional:
export R2_OBJECT_KEY="feed.xml"

deno run -A cli.ts --config feed.config.json --upload r2
```

R2 credentials are obtained from the Cloudflare dashboard under **R2 → Manage R2 API Tokens → Create
API Token**. Generate a token scoped to the target bucket with `Object Read & Write` permissions.

## Configuration

| Field                     | Type   | Default                | Description                                            |
| ------------------------- | ------ | ---------------------- | ------------------------------------------------------ |
| `input`                   | string | `./Clippings`          | Directory containing `.md` clippings                   |
| `output`                  | string | `./feed.xml`           | Output path                                            |
| `limit`                   | number | `5`                    | Max items in the feed                                  |
| `site.title`              | string | `My Clippings`         | Channel `<title>`                                      |
| `site.description`        | string | `Recent web clippings` | Channel `<description>`                                |
| `site.link`               | string | `https://example.com/` | Channel `<link>`; also used for `atom:link rel="self"` |
| `site.language`           | string | `en`                   | Channel `<language>`                                   |
| `frontmatter.title`       | string | `title`                | Frontmatter key supplying the item title               |
| `frontmatter.link`        | string | `source`               | Frontmatter key supplying the item link                |
| `frontmatter.description` | string | `description`          | Frontmatter key supplying the item description         |
| `frontmatter.date`        | string | `created`              | Frontmatter key supplying the item date (see below)    |
| `frontmatter.author`      | string | `author`               | Frontmatter key supplying the item author              |

### Priority: file-level CLI > config file > defaults

CLI flags override any value set in the config file; the config file overrides defaults.

### Date resolution

The filename timestamp (`YYYYMMDDHHmmss-...`) is always used for `pubDate` because it carries
seconds-level precision. Obsidian Web Clipper's `created` frontmatter field is typically a date-only
value (midnight UTC), which makes same-day items sort unpredictably.

## How it works

```
~/MyLife/Clippings/*.md
         │
         ▼
  parseFilename ── extract timestamp + slug from "YYYYMMDDHHmmss-<title>.md"
         │
         ▼
  parseClipping ── read YAML frontmatter, build a FeedItem
         │
         ▼
   buildFeed ──── sort by pubDate desc, tie-break by guid, take top N
         │
         ▼
   renderRss ──── emit RSS 2.0 XML
         │
         ▼
     feed.xml ─── (optional) upload to R2 via S3 API
```

Each step is a pure function with tests; the CLI is the only I/O layer.

## Automation

### GitHub Actions (recommended for public feeds)

```yaml
# .github/workflows/publish-feed.yml
on:
  push:
    paths: ["Clippings/**"]
  schedule:
    - cron: "0 * * * *"

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: denoland/setup-deno@v2
        with:
          deno-version: v2.x
      - run: |
          deno run -A https://raw.githubusercontent.com/staticWagomU/clipfeed/main/cli.ts \
            --input ./Clippings --upload r2
        env:
          R2_ACCOUNT_ID: ${{ secrets.R2_ACCOUNT_ID }}
          R2_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}
          R2_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}
          R2_BUCKET: ${{ secrets.R2_BUCKET }}
```

### launchd (local Mac scheduler)

```xml
<!-- ~/Library/LaunchAgents/com.staticwagomu.clipfeed.plist -->
<plist version="1.0">
<dict>
  <key>Label</key><string>com.staticwagomu.clipfeed</string>
  <key>ProgramArguments</key>
  <array>
    <string>/path/to/deno</string>
    <string>run</string><string>-A</string>
    <string>/path/to/clipfeed/cli.ts</string>
    <string>--config</string><string>/path/to/feed.config.json</string>
    <string>--upload</string><string>r2</string>
  </array>
  <key>StartInterval</key><integer>3600</integer>
</dict>
</plist>
```

## Development

```sh
deno task test    # run tests
deno task check   # fmt --check + lint + type-check
deno task fmt     # format source
```

## License

MIT
