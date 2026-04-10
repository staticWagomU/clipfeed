export type FeedItem = {
  title: string;
  link: string;
  description: string;
  pubDate: Date;
  guid: string;
  author?: string;
};

export type FrontmatterMap = {
  title: string;
  link: string;
  description: string;
  date: string;
  author: string;
};

export type SiteMeta = {
  title: string;
  description: string;
  link: string;
  language?: string;
};

export type UploadConfig = {
  /** Discriminator. Extend this union to add new upload backends. */
  type: "s3";
  /** Hostname (no scheme) of the S3-compatible endpoint. */
  endpoint: string;
  /** Region string (use "auto" for R2). */
  region: string;
  /** Target bucket name. */
  bucket: string;
  /** Object key within the bucket. */
  objectKey: string;
  /** Environment variable name holding the access key id (default: AWS_ACCESS_KEY_ID). */
  accessKeyIdEnv?: string;
  /** Environment variable name holding the secret access key (default: AWS_SECRET_ACCESS_KEY). */
  secretAccessKeyEnv?: string;
  /** Use HTTPS (default: true). Set to false for local MinIO etc. */
  useSSL?: boolean;
};

export type FeedFormat = "rss" | "atom" | "jsonfeed";

export type DateSource = "filename" | "frontmatter" | "mtime";

export type ClipfeedConfig = {
  input: string;
  output: string;
  limit: number;
  format: FeedFormat;
  dateSource: DateSource;
  site: SiteMeta;
  frontmatter: FrontmatterMap;
  upload?: UploadConfig;
};
