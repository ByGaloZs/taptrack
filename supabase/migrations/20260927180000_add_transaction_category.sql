alter table public.transactions add column category text;

alter table public.transactions
  add constraint transactions_category_check
  check (category is null or category in ('Supermercado', 'Transporte', 'Vivienda', 'Ocio', 'Viajes', 'Otro'));
