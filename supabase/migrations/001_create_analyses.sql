create table public.analyses (
  id text primary key,
  repo_url text not null,
  repo_owner text not null,
  repo_name text not null,
  repo_branch text,
  status text not null default 'pending' check (status in ('pending', 'analyzing', 'complete', 'error')),
  slop_score integer check (slop_score >= 0 and slop_score <= 100),
  scores jsonb,
  verdict text,
  receipts jsonb,
  metadata jsonb default '{}'::jsonb,
  error_message text,
  analyzed_at timestamptz,
  created_at timestamptz default now() not null
);

create index analyses_repo_idx on public.analyses(repo_owner, repo_name);
create index analyses_status_idx on public.analyses(status) where status in ('pending', 'analyzing');
