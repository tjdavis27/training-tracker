-- Florence Training Tracker v1.3.0
-- Safe to run on a brand-new project OR over the v1.0 / v1.1 schema.

create table if not exists public.training_employees (
  workspace text not null,
  id text not null,
  name text not null,
  active boolean not null default true,
  display_order integer not null default 999,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace, id)
);

create table if not exists public.training_progress (
  workspace text not null,
  employee_id text not null,
  requirement_id text not null,
  completed boolean not null default false,
  count integer,
  score numeric,
  completed_at date,
  completed_by text,
  notes text,
  updated_at timestamptz not null default now(),
  primary key (workspace, employee_id, requirement_id)
);

create table if not exists public.training_logs (
  id text primary key,
  workspace text not null,
  employee_id text not null,
  track text,
  activity text not null,
  trained_on text,
  went_well text,
  needs_work text,
  training_date date not null default current_date,
  trainer text,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.training_logs add column if not exists trained_on text;
alter table public.training_logs add column if not exists went_well text;
alter table public.training_logs add column if not exists needs_work text;

create table if not exists public.training_observations (
  id text primary key,
  workspace text not null,
  employee_id text not null,
  track text not null,
  room text not null,
  activity text not null,
  observed_at date,
  observed_by text,
  good_stuff text,
  needs_work text,
  score integer check (score between 1 and 10),
  created_at timestamptz not null default now()
);

create table if not exists public.training_resets (
  id text primary key,
  workspace text not null,
  employee_id text not null,
  track text not null,
  room text not null,
  reset_at date,
  observed_by text,
  reset_time text,
  good_stuff text,
  needs_work text,
  score integer check (score between 1 and 10),
  created_at timestamptz not null default now()
);

create table if not exists public.training_quiz_attempts (
  id text primary key,
  workspace text not null,
  employee_id text not null,
  track text not null,
  room text,
  quiz_id text not null,
  quiz_label text not null,
  taken_at date,
  observed_by text,
  result text check (result in ('pass','fail')),
  graded_at date,
  created_at timestamptz not null default now()
);

-- v1.3: TMs can submit a quiz as taken before TJ grades it.
alter table public.training_quiz_attempts alter column result drop not null;
alter table public.training_quiz_attempts add column if not exists graded_at date;

create table if not exists public.training_meta (
  workspace text not null,
  key text not null,
  value text,
  updated_at timestamptz not null default now(),
  primary key (workspace, key)
);

alter table public.training_employees enable row level security;
alter table public.training_progress enable row level security;
alter table public.training_logs enable row level security;
alter table public.training_observations enable row level security;
alter table public.training_resets enable row level security;
alter table public.training_quiz_attempts enable row level security;
alter table public.training_meta enable row level security;

-- Internal-team policies. Anyone who has the app credentials can read/write.
-- If you later want individual logins, replace these with Supabase Auth policies.
do $$
declare t text;
begin
  foreach t in array array['training_employees','training_progress','training_logs','training_observations','training_resets','training_quiz_attempts','training_meta'] loop
    execute format('drop policy if exists %I on public.%I', t || ' public read', t);
    execute format('drop policy if exists %I on public.%I', t || ' public write', t);
    execute format('create policy %I on public.%I for select using (true)', t || ' public read', t);
    execute format('create policy %I on public.%I for all using (true) with check (true)', t || ' public write', t);
  end loop;
end $$;

-- Realtime, but only add a table if it is not already in the publication.
do $$
declare t text;
begin
  foreach t in array array['training_employees','training_progress','training_logs','training_observations','training_resets','training_quiz_attempts'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename=t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
