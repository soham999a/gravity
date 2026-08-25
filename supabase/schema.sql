-- ============================================================
-- GRAVITY PLATFORM — full schema for Supabase
-- Safe to re-run: uses IF NOT EXISTS / ON CONFLICT everywhere
-- ============================================================

-- Enums (safe to re-run via DO block) ---------------------------------
DO $$ BEGIN
  CREATE TYPE mission_status AS ENUM ('pending','profiling','routing','executing','evaluating','completed','failed','escalated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE node_status AS ENUM ('queued','running','completed','failed','skipped');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE agent_class AS ENUM ('llm','statistical','ml','deterministic','hybrid','human');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tables (IF NOT EXISTS) -----------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  plan TEXT DEFAULT 'free',
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  email TEXT NOT NULL UNIQUE,
  role TEXT DEFAULT 'viewer',
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  agent_class agent_class NOT NULL,
  escalation_level INTEGER NOT NULL,
  purpose TEXT,
  model TEXT,
  tools JSONB DEFAULT '[]',
  cost_profile TEXT,
  reliability REAL DEFAULT 0,
  status TEXT DEFAULT 'active',
  fallback_id UUID
);

CREATE TABLE IF NOT EXISTS models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  provider TEXT,
  capability TEXT,
  cost_per_token REAL DEFAULT 0,
  latency_ms INTEGER DEFAULT 0,
  context_window INTEGER DEFAULT 0,
  quality REAL DEFAULT 0,
  placement TEXT DEFAULT 'local',
  status TEXT DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT,
  permissions TEXT,
  latency_ms INTEGER DEFAULT 0,
  success_rate REAL DEFAULT 1,
  status TEXT DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  user_id UUID REFERENCES users(id),
  prompt TEXT NOT NULL,
  status mission_status DEFAULT 'pending',
  domain TEXT,
  data_type TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  completed_at TIMESTAMP,
  total_cost REAL DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  total_latency_ms INTEGER DEFAULT 0,
  selected_strategy TEXT,
  escalation_level INTEGER,
  confidence REAL
);

CREATE TABLE IF NOT EXISTS problem_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID REFERENCES missions(id),
  data_type TEXT,
  complexity TEXT,
  signals JSONB DEFAULT '[]',
  dimensions JSONB DEFAULT '[]',
  summary TEXT
);

CREATE TABLE IF NOT EXISTS routing_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID REFERENCES missions(id),
  candidates JSONB DEFAULT '[]',
  selected_strategy TEXT,
  escalation_level INTEGER,
  voi_score REAL,
  confidence REAL,
  reasoning TEXT,
  estimated_tokens INTEGER,
  max_tokens INTEGER,
  early_stop BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS execution_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID REFERENCES missions(id),
  status node_status DEFAULT 'queued',
  total_cost REAL DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  total_latency_ms INTEGER DEFAULT 0,
  started_at TIMESTAMP DEFAULT now(),
  completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS execution_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES execution_runs(id),
  name TEXT,
  type TEXT,
  agent_id UUID,
  model_id UUID,
  status node_status DEFAULT 'queued',
  stage TEXT,
  purpose TEXT,
  input TEXT,
  output TEXT,
  cost REAL DEFAULT 0,
  tokens INTEGER DEFAULT 0,
  latency_ms INTEGER DEFAULT 0,
  confidence REAL DEFAULT 0,
  start_time TIMESTAMP,
  end_time TIMESTAMP
);

CREATE TABLE IF NOT EXISTS decision_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  mission_id UUID REFERENCES missions(id),
  task TEXT,
  data_profile TEXT,
  complexity TEXT,
  candidates JSONB DEFAULT '[]',
  selected_strategy TEXT,
  reasoning TEXT,
  rejected_alternatives TEXT,
  llm_calls INTEGER DEFAULT 0,
  tokens INTEGER DEFAULT 0,
  cost REAL DEFAULT 0,
  latency_ms INTEGER DEFAULT 0,
  confidence REAL,
  fallback_path TEXT,
  outcome TEXT,
  timestamp TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID REFERENCES missions(id),
  dimensions JSONB DEFAULT '[]',
  quality_score REAL,
  output_verdict TEXT,
  decision_verdict TEXT,
  feedback TEXT
);

CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  steps JSONB DEFAULT '[]'
);

-- Seed (all use ON CONFLICT so re-runnable) -----------------------------
INSERT INTO tenants (name, slug) VALUES ('MATRIX Lab', 'matrix-lab')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO agents (tenant_id, slug, name, agent_class, escalation_level, purpose, model, tools, cost_profile, reliability)
SELECT t.id, v.slug, v.name, v.agent_class::agent_class, v.level, v.purpose, v.model, v.tools::jsonb, v.cost_profile, v.reliability
FROM tenants t, (VALUES
  ('rule-solver', 'Rule Solver', 'deterministic', 0, 'Pure rule-based computation with zero token spend', NULL, '["sql","or-tools"]', 'free', 1.0),
  ('stat-engine', 'Statistical Engine', 'statistical', 1, 'Local forecasting, clustering and anomaly detection', NULL, '["prophet","xgboost"]', 'free', 0.95),
  ('compressor', 'Compressor', 'ml', 2, 'Embedding-based compression and representative sampling', 'nomic-embed', '["embed","kmeans"]', 'free', 0.92),
  ('small-analyst', 'Small Analyst', 'llm', 2, 'Single-pass synthesis on a compact local model', 'deepseek-coder:6.7b', '[]', 'local-free', 0.85),
  ('specialist', 'Specialist', 'llm', 3, 'Deep single-domain investigation with self-refinement', 'llama3:latest', '["search"]', 'local-free', 0.88),
  ('reasoner', 'Deep Reasoner', 'llm', 4, 'Extended chain-of-thought on demanding problems', 'deepseek-coder:33b', '[]', 'local-free', 0.86),
  ('planner', 'Planner', 'llm', 5, 'Decomposes missions into specialist briefs', 'llama3:latest', '[]', 'local-free', 0.9),
  ('critic', 'Critic', 'llm', 5, 'Challenges outputs and flags analytical gaps', 'llama3:latest', '[]', 'local-free', 0.87),
  ('synthesiser', 'Synthesiser', 'llm', 5, 'Merges specialist findings into final deliverables', 'llama3:latest', '[]', 'local-free', 0.91),
  ('human-gate', 'Human Gate', 'human', 6, 'Final judgment where automated confidence is insufficient', NULL, '["approval"]', 'human-time', 1.0)
) AS v(slug, name, agent_class, level, purpose, model, tools, cost_profile, reliability)
WHERE t.slug = 'matrix-lab'
ON CONFLICT DO NOTHING;

INSERT INTO models (tenant_id, slug, name, provider, capability, cost_per_token, latency_ms, context_window, quality, placement)
SELECT t.id, v.slug, v.name, v.provider, v.capability, v.cost_per_token, v.latency_ms, v.context_window, v.quality, v.placement
FROM tenants t, (VALUES
  ('ollama-llama3', 'Llama 3 8B', 'ollama', 'general-reasoning', 0, 4200, 8192, 0.78, 'local'),
  ('ollama-ds-6b', 'DeepSeek Coder 6.7B', 'ollama', 'code-and-analysis', 0, 3100, 16384, 0.74, 'local'),
  ('ollama-ds-33b', 'DeepSeek Coder 33B', 'ollama', 'advanced-reasoning', 0, 11000, 16384, 0.84, 'local'),
  ('nomic-embed', 'Nomic Embed', 'ollama', 'embedding', 0, 40, 8192, 0.9, 'local')
) AS v(slug, name, provider, capability, cost_per_token, latency_ms, context_window, quality, placement)
WHERE t.slug = 'matrix-lab'
ON CONFLICT DO NOTHING;

INSERT INTO tools (tenant_id, slug, name, type, permissions, latency_ms, success_rate)
SELECT t.id, v.slug, v.name, v.type, v.permissions, v.latency_ms, v.success_rate
FROM tenants t, (VALUES
  ('sql-exec', 'SQL Executor', 'database', 'read-only', 350, 0.99),
  ('file-reader', 'File Reader', 'filesystem', 'read-only', 120, 0.98),
  ('web-search', 'Web Search', 'network', 'read-only', 900, 0.93),
  ('calc', 'Calculator', 'compute', 'none', 5, 1.0)
) AS v(slug, name, type, permissions, latency_ms, success_rate)
WHERE t.slug = 'matrix-lab'
ON CONFLICT DO NOTHING;

INSERT INTO workflows (tenant_id, slug, name, description, steps)
SELECT t.id, 'analysis-standard', 'Standard Analysis Pipeline', 'Profile -> route -> execute -> evaluate with full ledger capture', '[{"id":"1","name":"Profile","type":"deterministic","tools":["calc"],"timeout":30},{"id":"2","name":"Route","type":"deterministic","tools":["calc"],"timeout":10},{"id":"3","name":"Execute","type":"multi_agent","tools":[],"timeout":300},{"id":"4","name":"Evaluate","type":"deterministic","tools":["calc"],"timeout":30}]'::jsonb
FROM tenants t WHERE t.slug = 'matrix-lab'
ON CONFLICT DO NOTHING;

-- Row Level Security (permissive for demo) ------------------------------
ALTER TABLE tenants              ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents               ENABLE ROW LEVEL SECURITY;
ALTER TABLE models               ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools                ENABLE ROW LEVEL SECURITY;
ALTER TABLE missions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE problem_profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE routing_decisions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_runs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_nodes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_ledger      ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows            ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "public access tenants" ON tenants FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "public access users" ON users FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "public access agents" ON agents FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "public access models" ON models FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "public access tools" ON tools FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "public access missions" ON missions FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "public access profiles" ON problem_profiles FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "public access routing" ON routing_decisions FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "public access runs" ON execution_runs FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "public access nodes" ON execution_nodes FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "public access ledger" ON decision_ledger FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "public access evaluations" ON evaluations FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "public access workflows" ON workflows FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
