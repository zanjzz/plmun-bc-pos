create unique index if not exists transactions_order_unique_idx
  on public.transactions(order_id)
  where order_id is not null;
