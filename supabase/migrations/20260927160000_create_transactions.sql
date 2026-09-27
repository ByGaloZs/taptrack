create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  merchant text not null,
  amount numeric not null,
  currency text not null,
  card text not null,
  occurred_at timestamptz not null,
  source text not null,
  client_transaction_id text unique,
  created_at timestamptz not null default now()
);

alter table public.transactions enable row level security;
