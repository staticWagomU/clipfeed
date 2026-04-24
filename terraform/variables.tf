variable "cloudflare_api_token" {
  description = "Cloudflare API token (Account:Cloudflare R2:Edit + Zone:DNS:Edit on wagomu.me)"
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare account ID that owns the R2 bucket and wagomu.me zone"
  type        = string
}

variable "zone_id" {
  description = "Cloudflare zone ID for wagomu.me (Overview pane, right sidebar in dashboard)"
  type        = string
}

variable "bucket_name" {
  description = "R2 bucket name for clipfeed artifacts"
  type        = string
  default     = "clipfeed"
}

variable "bucket_location" {
  description = "R2 bucket location hint (APAC / WNAM / ENAM / WEUR / EEUR)"
  type        = string
  default     = "APAC"
}

variable "feed_domain" {
  description = "Public custom domain that serves feed.xml from the R2 bucket"
  type        = string
}

