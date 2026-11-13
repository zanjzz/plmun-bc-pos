drop index if exists public.product_variations_sku_unique_idx;

create unique index product_variations_sku_unique_idx
  on public.product_variations(lower(sku))
  where sku <> '' and active = true;

create or replace function public.sync_product_variations(
  p_product_id bigint,
  p_variations jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if jsonb_typeof(p_variations) <> 'array' then
    raise exception 'Variations must be an array.';
  end if;

  if exists (
    select 1
    from public.product_variations variation
    join jsonb_array_elements(p_variations) item
      on item ->> 'key' = variation.combination_key
    where variation.product_id = p_product_id
      and (
        item ->> 'updatedAt' is null
        or (item ->> 'updatedAt')::timestamptz <> variation.updated_at
      )
  ) then
    raise exception 'Variation inventory changed while it was being edited.';
  end if;

  update public.product_variations
  set active = false
  where product_id = p_product_id;

  insert into public.product_variations (
    product_id,
    combination_key,
    attributes,
    sku,
    price,
    stock,
    active,
    image
  )
  select
    p_product_id,
    item ->> 'key',
    coalesce(item -> 'attributes', '{}'::jsonb),
    coalesce(item ->> 'sku', ''),
    (item ->> 'price')::numeric,
    (item ->> 'stock')::integer,
    coalesce((item ->> 'active')::boolean, true),
    nullif(item ->> 'image', '')
  from jsonb_array_elements(p_variations) item
  on conflict (product_id, combination_key)
  do update set
    attributes = excluded.attributes,
    sku = excluded.sku,
    price = excluded.price,
    stock = excluded.stock,
    active = excluded.active,
    image = excluded.image;
end;
$$;

revoke all on function public.sync_product_variations(bigint, jsonb)
  from public, anon, authenticated;
grant execute on function public.sync_product_variations(bigint, jsonb)
  to service_role;
