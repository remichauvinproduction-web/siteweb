CREATE TABLE IF NOT EXISTS gallery_download_emails (
  email TEXT NOT NULL,
  gallery_slug TEXT NOT NULL,
  first_download_at TEXT NOT NULL,
  last_download_at TEXT NOT NULL,
  PRIMARY KEY (email, gallery_slug)
);

CREATE INDEX IF NOT EXISTS idx_gallery_download_last_download
  ON gallery_download_emails (last_download_at);
