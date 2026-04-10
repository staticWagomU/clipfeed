# clipfeed

Turn a directory of Markdown clippings (e.g. [Obsidian Web Clipper](https://obsidian.md/clipper)
output) into an RSS / Atom / JSON Feed — with optional upload to any S3-compatible object store.

- **Multiple feed formats**: RSS 2.0, Atom 1.0, JSON Feed 1.1
- **Multiple date sources**: filename timestamp, frontmatter date, or file mtime
- **Pluggable storage**: works with Cloudflare R2, AWS S3, MinIO, Backblaze B2, Wasabi, DigitalOcean
  Spaces, Linode Object Storage, or anything that speaks the S3 API
- **Scheduler-agnostic**: just a CLI, so drop it in cron / systemd / launchd / GitHub Actions /
  Kubernetes CronJob / Docker one-shot — no daemon, no state
- **No `node_modules`**: Deno-native, JSR-only dependencies

## Install

Requires [Deno](https://deno.com) 2.x.

```sh
git clone https://github.com/staticWagomU/clipfeed.git
cd clipfeed
deno task test
```

## Quick start

```sh
deno run -A cli.ts \
  --input ~/MyLife/Clippings \
  --output ./feed.xml \
  --limit 5 \
  --format rss
```

With a config file:

```sh
deno run -A cli.ts --config ./feed.config.json
```

Override selected fields on top of a config file:

```sh
deno run -A cli.ts --config ./feed.config.json --format atom --limit 20
```

## Configuration

| Field              | Type    | Default        | Description                                                                                  |
| ------------------ | ------- | -------------- | -------------------------------------------------------------------------------------------- |
| `input`            | string  | `./Clippings`  | Directory containing `.md` clippings                                                         |
| `output`           | string  | format-based   | Output path. Default: `./feed.xml` (rss), `./feed.atom.xml` (atom), `./feed.json` (jsonfeed) |
| `limit`            | number  | `5`            | Max items in the feed                                                                        |
| `format`           | enum    | `"rss"`        | `rss` / `atom` / `jsonfeed`                                                                  |
| `dateSource`       | enum    | `"filename"`   | `filename` / `frontmatter` / `mtime` (see below)                                             |
| `site.title`       | string  | `My Clippings` | Feed `<title>`                                                                               |
| `site.description` | string  | —              | Feed description / subtitle                                                                  |
| `site.link`        | string  | —              | Public URL of the feed's HTML landing page                                                   |
| `site.language`    | string  | `en`           | BCP 47 language tag                                                                          |
| `frontmatter.*`    | mapping | see below      | Maps feed fields to frontmatter keys (for non-default clippers)                              |
| `upload`           | object  | —              | Upload backend — see [Upload backends](#upload-backends)                                     |

### Frontmatter mapping

If your clippings use frontmatter keys other than Obsidian Web Clipper's defaults, override them in
`frontmatter`:

```json
"frontmatter": {
  "title": "headline",
  "link": "original_url",
  "description": "excerpt",
  "date": "published_at",
  "author": "byline"
}
```

Defaults are the Obsidian Web Clipper standard: `title` / `source` / `description` / `created` /
`author`.

### Date source strategies

| Strategy      | Picks...                                          | Use when                                                         |
| ------------- | ------------------------------------------------- | ---------------------------------------------------------------- |
| `filename`    | `YYYYMMDDHHmmss` prefix of the filename (UTC)     | Your clipper timestamps filenames (Obsidian Web Clipper default) |
| `frontmatter` | The frontmatter field named in `frontmatter.date` | You have Hugo/Jekyll-style `date: 2026-04-01` frontmatter        |
| `mtime`       | The file system modification time                 | Ad-hoc Markdown files without timestamps in name or frontmatter  |

> **Note**: `mtime` is rewritten by `rsync`, `git checkout`, and many editors. Prefer `filename` or
> `frontmatter` if your workflow involves version control.

`frontmatter` strategy automatically falls back to the filename timestamp if the frontmatter field
is missing — you get progressive enhancement for free.

## Upload backends

clipfeed uses the S3 protocol for uploads, so a single `upload.type = "s3"` block covers every
S3-compatible provider. Credentials are always read from environment variables — never stored in the
config file — so the same config can be committed to a public repo.

### Cloudflare R2

```json
"upload": {
  "type": "s3",
  "endpoint": "YOUR_ACCOUNT_ID.r2.cloudflarestorage.com",
  "region": "auto",
  "bucket": "your-bucket",
  "objectKey": "feed.xml",
  "accessKeyIdEnv": "R2_ACCESS_KEY_ID",
  "secretAccessKeyEnv": "R2_SECRET_ACCESS_KEY"
}
```

Generate credentials at **Cloudflare Dashboard → R2 → Manage R2 API Tokens → Create API Token** with
`Object Read & Write` scoped to your bucket.

See [`examples/presets/r2.config.json`](./examples/presets/r2.config.json).

### AWS S3

```json
"upload": {
  "type": "s3",
  "endpoint": "s3.amazonaws.com",
  "region": "us-east-1",
  "bucket": "your-bucket",
  "objectKey": "feed.xml",
  "accessKeyIdEnv": "AWS_ACCESS_KEY_ID",
  "secretAccessKeyEnv": "AWS_SECRET_ACCESS_KEY"
}
```

See [`examples/presets/aws-s3.config.json`](./examples/presets/aws-s3.config.json).

### MinIO (self-hosted)

```json
"upload": {
  "type": "s3",
  "endpoint": "localhost:9000",
  "region": "us-east-1",
  "bucket": "clipfeed",
  "objectKey": "feed.json",
  "accessKeyIdEnv": "MINIO_ACCESS_KEY",
  "secretAccessKeyEnv": "MINIO_SECRET_KEY",
  "useSSL": false
}
```

See [`examples/presets/minio.config.json`](./examples/presets/minio.config.json).

### Backblaze B2

```json
"upload": {
  "type": "s3",
  "endpoint": "s3.us-west-004.backblazeb2.com",
  "region": "us-west-004",
  "bucket": "your-bucket",
  "objectKey": "feed.xml",
  "accessKeyIdEnv": "B2_APPLICATION_KEY_ID",
  "secretAccessKeyEnv": "B2_APPLICATION_KEY"
}
```

See [`examples/presets/b2.config.json`](./examples/presets/b2.config.json).

### Other providers

The same block works for Wasabi, DigitalOcean Spaces, Linode Object Storage, iDrive E2, Scaleway,
Oracle OCI, and any other provider that offers an S3-compatible endpoint — just plug in the right
`endpoint` and `region`.

### Running an upload

```sh
export R2_ACCESS_KEY_ID=...
export R2_SECRET_ACCESS_KEY=...
deno run -A cli.ts --config feed.config.json --upload
```

## Scheduling

clipfeed is deliberately a stateless one-shot CLI. That means you can run it from **any** scheduler
— there is no daemon mode, no built-in cron, and no lock file. Pick whichever scheduler matches your
environment.

### cron (any Linux / macOS / BSD)

```cron
# Run every hour at :05
5 * * * * cd $HOME/vault && /usr/local/bin/deno run -A /path/to/clipfeed/cli.ts --config feed.config.json --upload >> /var/log/clipfeed.log 2>&1
```

### systemd user timer (Linux)

```ini
# ~/.config/systemd/user/clipfeed.service
[Unit]
Description=clipfeed — rebuild feed.xml

[Service]
Type=oneshot
WorkingDirectory=%h/vault
Environment=R2_ACCESS_KEY_ID=...
Environment=R2_SECRET_ACCESS_KEY=...
ExecStart=/usr/bin/deno run -A %h/src/clipfeed/cli.ts --config %h/vault/feed.config.json --upload
```

```ini
# ~/.config/systemd/user/clipfeed.timer
[Unit]
Description=Run clipfeed every hour

[Timer]
OnBootSec=5min
OnUnitActiveSec=1h
Persistent=true

[Install]
WantedBy=timers.target
```

```sh
systemctl --user enable --now clipfeed.timer
```

### launchd (macOS)

```xml
<!-- ~/Library/LaunchAgents/com.staticwagomu.clipfeed.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.staticwagomu.clipfeed</string>
  <key>ProgramArguments</key>
  <array>
    <string>/opt/homebrew/bin/deno</string>
    <string>run</string>
    <string>-A</string>
    <string>/Users/you/src/clipfeed/cli.ts</string>
    <string>--config</string>
    <string>/Users/you/vault/feed.config.json</string>
    <string>--upload</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>R2_ACCESS_KEY_ID</key><string>...</string>
    <key>R2_SECRET_ACCESS_KEY</key><string>...</string>
  </dict>
  <key>StartInterval</key><integer>3600</integer>
  <key>StandardOutPath</key><string>/tmp/clipfeed.log</string>
  <key>StandardErrorPath</key><string>/tmp/clipfeed.err</string>
</dict>
</plist>
```

```sh
launchctl load ~/Library/LaunchAgents/com.staticwagomu.clipfeed.plist
```

### GitHub Actions

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
            --config feed.config.json --upload
        env:
          R2_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}
          R2_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}
```

### Docker one-shot (for Kubernetes CronJob, Fly Machines, etc.)

```dockerfile
FROM denoland/deno:alpine
COPY . /app
WORKDIR /app
ENTRYPOINT ["deno", "run", "-A", "/app/cli.ts"]
```

```sh
docker run --rm \
  -v $PWD/Clippings:/data/Clippings \
  -v $PWD/feed.config.json:/data/feed.config.json \
  -e R2_ACCESS_KEY_ID -e R2_SECRET_ACCESS_KEY \
  -w /data clipfeed --config feed.config.json --upload
```

All of these do the exact same thing: invoke `clipfeed` once, which builds a feed and uploads it.
The CLI is the integration surface — there is nothing scheduler-specific in the code.

## Architecture

```
Clippings/*.md
      │
      ▼
parseFilename ─── YYYYMMDDHHmmss → Date + slug + stem
      │
parseClipping ─── frontmatter → FeedItem (field mapping is configurable)
      │
resolveDate ────── picks pubDate per the filename / frontmatter / mtime strategy
      │
 buildFeed ─────── sort desc, deterministic tie-break, take top N
      │
 ┌────┴────┐
 ▼         ▼         ▼
renderRss  renderAtom  renderJsonFeed        (strategy by `format` config)
      │
      ▼
Deno.writeTextFile ─── local output
      │
 uploadS3 ─────────── optional S3-compatible PUT  (strategy by `upload.type`)
```

Every stage except the I/O at the top and bottom is a pure function. The CLI layer is a thin
orchestration shim that can be swapped out (e.g. imported into a Deno Deploy handler for dynamic
feeds).

## Development

```sh
deno task test     # run tests
deno task check    # fmt --check + lint + type-check
deno task fmt      # auto-format
```

128 tests cover every pure function plus the CLI orchestration layer (parse → build → render → write
pipeline, format dispatch, error handling); CI runs on every push.

## License

MIT
