alter table public.products
  add column if not exists sizes text[] not null default '{}'::text[];

alter table public.order_items
  add column if not exists selected_size text;

alter table public.transaction_items
  add column if not exists selected_size text;

update public.products
set sizes = array['XS', 'S', 'M', 'L', 'XL', '2XL']
where name in ('School Uniform Set', 'PE Uniform Set')
  and cardinality(sizes) = 0;
