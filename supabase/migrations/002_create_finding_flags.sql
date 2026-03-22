create table public.finding_flags (
  id uuid primary key default gen_random_uuid(),
  analysis_id text not null,
  finding_index integer not null,
  finding_issue text not null,
  finding_file text,
  finding_severity text not null,
  dimension text not null,
  reason text check (char_length(reason) <= 500),
  ip_hash text not null,
  created_at timestamptz default now() not null,

  unique (analysis_id, finding_index, ip_hash)
);

create index idx_finding_flags_analysis on public.finding_flags (analysis_id);
create index idx_finding_flags_dimension on public.finding_flags (dimension);
create index idx_finding_flags_created on public.finding_flags (created_at desc);
