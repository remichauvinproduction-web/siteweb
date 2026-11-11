CREATE TABLE IF NOT EXISTS gallery_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gallery_slug TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('view', 'favorite', 'unfavorite', 'download_single', 'download_all', 'selection')),
  photo_index INTEGER,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gallery_events_slug_date
  ON gallery_events (gallery_slug, created_at);

CREATE INDEX IF NOT EXISTS idx_gallery_events_slug_type
  ON gallery_events (gallery_slug, event_type);

CREATE TABLE IF NOT EXISTS gallery_selections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gallery_slug TEXT NOT NULL,
  client_email TEXT,
  selected_photos TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new'
);

CREATE INDEX IF NOT EXISTS idx_gallery_selections_slug_date
  ON gallery_selections (gallery_slug, created_at);

CREATE TABLE IF NOT EXISTS gallery_orders (
  stripe_session_id TEXT PRIMARY KEY,
  gallery_slug TEXT NOT NULL,
  media_keys TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gallery_orders_slug_date
  ON gallery_orders (gallery_slug, created_at);
