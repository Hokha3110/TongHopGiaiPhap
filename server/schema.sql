CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY, username text NOT NULL UNIQUE, display_name text NOT NULL,
  password_hash text NOT NULL, role text NOT NULL CHECK (role IN ('admin','editor','member')),
  active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE TABLE IF NOT EXISTS login_attempts (
  key text PRIMARY KEY, count integer NOT NULL, started_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS entries (
  id text PRIMARY KEY, draft jsonb NOT NULL, published jsonb,
  revision integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
CREATE TABLE IF NOT EXISTS documents (
  id text PRIMARY KEY, entry_id text NOT NULL REFERENCES entries(id), name text NOT NULL,
  folder text NOT NULL DEFAULT '', current_version text, deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS document_versions (
  id text PRIMARY KEY, document_id text NOT NULL REFERENCES documents(id),
  root_kind text NOT NULL CHECK (root_kind IN ('solutions','uploads')),
  relative_path text NOT NULL, original_name text NOT NULL, extension text NOT NULL,
  size bigint NOT NULL CHECK (size >= 0), created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(root_kind, relative_path)
);
CREATE INDEX IF NOT EXISTS documents_entry_idx ON documents(entry_id);
CREATE INDEX IF NOT EXISTS document_versions_doc_idx ON document_versions(document_id);
CREATE TABLE IF NOT EXISTS audit_log (
  id bigserial PRIMARY KEY, actor_id text REFERENCES users(id), actor_name text NOT NULL,
  action text NOT NULL, target_id text NOT NULL, details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO schema_migrations(version) VALUES(1) ON CONFLICT DO NOTHING;
