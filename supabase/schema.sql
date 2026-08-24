-- ============================================================
-- GRAVITY PLATFORM — full schema for Supabase
-- Paste this whole file into: Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================

-- Enums -------------------------------------------------------
create type mission_status as enum (
  'pending', 'profiling', 'routing', 'executing', 'evaluating', 'completed', 'failed', 'escalated'
);
create type node_status as enum ('queued', 'running', 'completed', 'failed', 'skipped');
create type agent_class as enum ('llm', 'statistical', 'ml', 'deterministic', 'hybrid', 'human');

-- Tables ------------------------------------------------------
create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  plan text default 'free',
  created_at timestamp not null default now()
);

create table users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  email text not null unique,
  role text default 'viewer',
  name text,
  avatar_url text,
  created_at timestamp not null default now()
);

create table agents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  slug text not null,
  name text not null,
  agent_class agent_class not null,
  escalation_level integer not null,
  purpose text,
  model text,
  tools jsonb default '[]',
  cost_profile text,
  reliability real default 0,
  status text default 'active',
  fallback_id uuid
);

create table models (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  slug text not null,
  name text not null,
  provider text,
  capability text,
  cost_per_token real default 0,
  latency_ms integer default 0,
  context_window integer default 0,
  quality real default 0,
  placement text default 'local',
  status text default 'active'
);

create table tools (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  slug text not null,
  name text not null,
  type text,
  permissions text,
  latency_ms integer default 0,
  success_rate real default 1,
  status text default 'active'
);

create table missions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  user_id uuid references users(id),
  prompt text not null,
  status mission_status default 'pending',
  domain text,
  data_type text,
  created_at timestamp not null default now(),
  completed_at timestamp,
  total_cost real default 0,
  total_tokens integer default 0,
  total_latency_ms integer default 0,
  selected_strategy text,
  escalation_level integer,
  confidence real
);

create table problem_profiles (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid references missions(id),
  data_type text,
  complexity text,
  signals jsonb default '[]',
  dimensions jsonb default '[]',
  summary text
);

create table routing_decisions (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid references missions(id),
  candidates jsonb default '[]',
  selected_strategy text,
  escalation_level integer,
  voi_score real,
  confidence real,
  reasoning text,
  estimated_tokens integer,
  max_tokens integer,
  early_stop boolean default false
);

create table execution_runs (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid references missions(id),
  status node_status default 'queued',
  total_cost real default 0,
  total_tokens integer default 0,
  total_latency_ms integer default 0,
  started_at timestamp default now(),
  completed_at timestamp
);

create table execution_nodes (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references execution_runs(id),
  name text,
  type text,
  agent_id uuid,
  model_id uuid,
  status node_status default 'queued',
  stage text,
  purpose text,
  input text,
  output text,
  cost real default 0,
  tokens integer default 0,
  latency_ms integer default 0,
  confidence real default 0,
  start_time timestamp,
  end_time timestamp
);

create table decision_ledger (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  mission_id uuid references missions(id),
  task text,
  data_profile text,
  complexity text,
  candidates jsonb default '[]',
  selected_strategy text,
  reasoning text,
  rejected_alternatives text,
  llm_calls integer default 0,
  tokens integer default 0,
  cost real default 0,
  latency_ms integer default 0,
  confidence real,
  fallback_path text,
  outcome text,
  timestamp timestamp default now()
);

create table evaluations (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid references missions(id),
  dimensions jsonb default '[]',
  quality_score real,
  output_verdict text,
  decision_verdict text,
  feedback text
);

create table workflows (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  slug text not null,
  name text not null,
  description text,
  steps jsonb default '[]'
);

-- Seed --------------------------------------------------------
insert into tenants (name, slug) values ('MATRIX Lab', 'matrix-lab')
on conflict (slug) do nothing;

insert into agents (tenant_id, slug, name, agent_class, escalation_level, purpose, model, tools, cost_profile, reliability)
select t.id, v.slug, v.name, v.agent_class::agent_class, v.level, v.purpose, v.model, v.tools::jsonb, v.cost_profile, v.reliability
from tenants t, (values
  ('rule-solver', 'Rule Solver', 'deterministic', 0, 'Pure rule-based computation with zero token spend', null, '["sql","or-tools"]', 'free', 1.0),
  ('stat-engine', 'Statistical Engine', 'statistical', 1, 'Local forecasting, clustering and anomaly detection', null, '["prophet","xgboost"]', 'free', 0.95),
  ('compressor', 'Compressor', 'ml', 2, 'Embedding-based compression and representative sampling', 'nomic-embed', '["embed","kmeans"]', 'free', 0.92),
  ('small-analyst', 'Small Analyst', 'llm', 2, 'Single-pass synthesis on a compact local model', 'deepseek-coder:6.7b', '[]', 'local-free', 0.85),
  ('specialist', 'Specialist', 'llm', 3, 'Deep single-domain investigation with self-refinement', 'llama3:latest', '["search"]', 'local-free', 0.88),
  ('reasoner', 'Deep Reasoner', 'llm', 4, 'Extended chain-of-thought on demanding problems', 'deepseek-coder:33b', '[]', 'local-free', 0.86),
  ('planner', 'Planner', 'llm', 5, 'Decomposes missions into specialist briefs', 'llama3:latest', '[]', 'local-free', 0.9),
  ('critic', 'Critic', 'llm', 5, 'Challenges outputs and flags analytical gaps', 'llama3:latest', '[]', 'local-free', 0.87),
  ('synthesiser', 'Synthesiser', 'llm', 5, 'Merges specialist findings into final deliverables', 'llama3:latest', '[]', 'local-free', 0.91),
  ('human-gate', 'Human Gate', 'human', 6, 'Final judgment where automated confidence is insufficient', null, '["approval"]', 'human-time', 1.0)
) as v(slug, name, agent_class, level, purpose, model, tools, cost_profile, reliability)
where t.slug = 'matrix-lab';

insert into models (tenant_id, slug, name, provider, capability, cost_per_token, latency_ms, context_window, quality, placement)
select t.id, v.slug, v.name, v.provider, v.capability, v.cost_per_token, v.latency_ms, v.context_window, v.quality, v.placement
from tenants t, (values
  ('ollama-llama3', 'Llama 3 8B', 'ollama', 'general-reasoning', 0, 4200, 8192, 0.78, 'local'),
  ('ollama-ds-6b', 'DeepSeek Coder 6.7B', 'ollama', 'code-and-analysis', 0, 3100, 16384, 0.74, 'local'),
  ('ollama-ds-33b', 'DeepSeek Coder 33B', 'ollama', 'advanced-reasoning', 0, 11000, 16384, 0.84, 'local'),
  ('nomic-embed', 'Nomic Embed', 'ollama', 'embedding', 0, 40, 8192, 0.9, 'local')
) as v(slug, name, provider, capability, cost_per_token, latency_ms, context_window, quality, placement)
where t.slug = 'matrix-lab';

insert into tools (tenant_id, slug, name, type, permissions, latency_ms, success_rate)
select t.id, v.slug, v.name, v.type, v.permissions, v.latency_ms, v.success_rate
from tenants t, (values
  ('sql-exec', 'SQL Executor', 'database', 'read-only', 350, 0.99),
  ('file-reader', 'File Reader', 'filesystem', 'read-only', 120, 0.98),
  ('web-search', 'Web Search', 'network', 'read-only', 900, 0.93),
  ('calc', 'Calculator', 'compute', 'none', 5, 1.0)
) as v(slug, name, type, permissions, latency_ms, success_rate)
where t.slug = 'matrix-lab';

insert into workflows (tenant_id, slug, name, description, steps)
select t.id, 'analysis-standard', 'Standard Analysis Pipeline', 'Profile → route → execute → evaluate with full ledger capture', '[{"id":"1","name":"Profile","type":"deterministic","tools":["calc"],"timeout":30},{"id":"2","name":"Route","type":"deterministic","tools":["calc"],"timeout":10},{"id":"3","name":"Execute","type":"multi_agent","tools":[],"timeout":300},{"id":"4","name":"Evaluate","type":"deterministic","tools":["calc"],"timeout":30}]'::jsonb
from tenants t where t.slug = 'matrix-lab';

-- Row Level Security: open for local demo (no auth wired yet) --
alter table tenants enable row level security;
alter table users enable row level security;
alter table agents enable row level security;
alter table models enable row level security;
alter table tools enable row level security;
alter table missions enable row level security;
alter table problem_profiles enable row level security;
alter table routing_decisions enable row level security;
alter table execution_runs enable row level security;
alter table execution_nodes enable row level security;
alter table decision_ledger enable row level security;
alter table evaluations enable row level security;
alter table workflows enable row level security;

create policy "public access tenants" on tenants for all using (true) with check (true);
create policy "public access users" on users for all using (true) with check (true);
create policy "public access agents" on agents for all using (true) with check (true);
create policy "public access models" on models for all using (true) with check (true);
create policy "public access tools" on tools for all using (true) with check (true);
create policy "public access missions" on missions for all using (true) with check (true);
create policy "public access profiles" on problem_profiles for all using (true) with check (true);
create policy "public access routing" on routing_decisions for all using (true) with check (true);
create policy "public access runs" on execution_runs for all using (true) with check (true);
create policy "public access nodes" on execution_nodes for all using (true) with check (true);
create policy "public access ledger" on decision_ledger for all using (true) with check (true);
create policy "public access evaluations" on evaluations for all using (true) with check (true);
create policy "public access workflows" on workflows for all using (true) with check (true);
