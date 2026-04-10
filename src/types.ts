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

export type ClipfeedConfig = {
  input: string;
  output: string;
  limit: number;
  site: SiteMeta;
  frontmatter: FrontmatterMap;
};
