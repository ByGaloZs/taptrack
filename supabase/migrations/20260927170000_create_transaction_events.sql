create table public.transaction_events (
  id uuid primary key default gen_random_uuid(),
  payload jsonb not null,
  status text not null,
  error text,
  transaction_id uuid references public.transactions(id),
  created_at timestamptz not null default now()
);

alter table public.transaction_events enable row level security;
