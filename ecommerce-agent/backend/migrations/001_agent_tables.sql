-- Tablas del agente (conviven con las tablas del ecommerce en el mismo Postgres)
-- Ver docs/arquitectura-agente-ecommerce.md secciones 10, 12, 14 y 23.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS agent_sessions (
  session_key          text PRIMARY KEY,
  role                 text NOT NULL DEFAULT 'admin',
  last_product_list    jsonb,
  last_focus_product_id text,
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts            timestamptz NOT NULL DEFAULT now(),
  session_key   text NOT NULL,
  user_id       text NOT NULL,
  tool          text NOT NULL,
  params        jsonb,
  status        text NOT NULL, -- ok | error | rejected | confirmation_required | expired | idempotent_replay
  error         jsonb,
  entity_type   text,
  entity_id     text,
  diff          jsonb,
  request_id    text,
  duration_ms   integer,
  idempotent_replay boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_audit_session ON audit_log (session_key, ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_tool ON audit_log (tool, ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log (entity_type, entity_id);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key         text PRIMARY KEY,
  response    jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pending_actions (
  id          text PRIMARY KEY,
  session_key text NOT NULL,
  user_id     text NOT NULL,
  tool        text NOT NULL,
  params      jsonb NOT NULL,
  preview     jsonb NOT NULL,
  status      text NOT NULL DEFAULT 'pending', -- pending | confirmed | cancelled | expired
  created_by  text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  resolved_at timestamptz
);

CREATE TABLE IF NOT EXISTS bulk_jobs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type       text NOT NULL,
  filter     jsonb,
  params     jsonb,
  status     text NOT NULL DEFAULT 'queued',
  total      integer NOT NULL DEFAULT 0,
  done       integer NOT NULL DEFAULT 0,
  failed     integer NOT NULL DEFAULT 0,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  text NOT NULL,
  delta       integer NOT NULL,
  reason      text,
  source      text NOT NULL DEFAULT 'agent',
  session_key text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS images (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_key text UNIQUE NOT NULL,
  url         text NOT NULL,
  alt_text    text,
  sha256      text UNIQUE,
  meta        jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
