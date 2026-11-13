update public.products product
set product_type = 'variable'
where product_type = 'simple'
  and exists (
    select 1
    from public.product_variations variation
    where variation.product_id = product.id
      and variation.active = true
  );

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
    coalesce((item ->> 'stock')::integer, 0),
    coalesce((item ->> 'active')::boolean, true),
    nullif(item ->> 'image', '')
  from jsonb_array_elements(p_variations) item
  on conflict (product_id, combination_key)
  do update set
    attributes = excluded.attributes,
    sku = excluded.sku,
    price = excluded.price,
    active = excluded.active,
    image = excluded.image;
end;
$$;

revoke all on function public.sync_product_variations(bigint, jsonb)
  from public, anon, authenticated;
grant execute on function public.sync_product_variations(bigint, jsonb)
  to service_role;

create or replace function public.protect_inventory_on_product_type_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.product_type = new.product_type then
    return new;
  end if;

  if old.product_type = 'simple' and old.stock > 0 then
    raise exception 'Set product inventory to zero before changing its type.';
  end if;

  if old.product_type = 'variable' and exists (
    select 1
    from public.product_variations
    where product_id = old.id and stock > 0
  ) then
    raise exception 'Set all variation inventory to zero before changing product type.';
  end if;

  return new;
end;
$$;

drop trigger if exists products_protect_inventory_type on public.products;
create trigger products_protect_inventory_type
before update of product_type on public.products
for each row execute function public.protect_inventory_on_product_type_change();

create or replace function public.adjust_inventory(
  p_product_id bigint,
  p_variation_id bigint,
  p_quantity_change integer,
  p_actor_id uuid,
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_stock integer;
  next_stock integer;
  current_type text;
begin
  if p_quantity_change = 0 then
    raise exception 'Stock adjustment cannot be zero.';
  end if;

  select product_type into current_type
  from public.products
  where id = p_product_id and active = true
  for update;

  if current_type is null then
    raise exception 'Product not found.';
  end if;

  if current_type = 'variable' then
    if p_variation_id is null then
      raise exception 'Choose a product variation.';
    end if;
    select stock into current_stock
    from public.product_variations
    where id = p_variation_id and product_id = p_product_id
    for update;
    if current_stock is null then
      raise exception 'Product variation not found.';
    end if;
    next_stock := current_stock + p_quantity_change;
    if next_stock < 0 then
      raise exception 'Stock cannot go below zero.';
    end if;
    update public.product_variations
    set stock = next_stock
    where id = p_variation_id;
  else
    if p_variation_id is not null then
      raise exception 'This product does not use variations.';
    end if;
    select stock into current_stock
    from public.products
    where id = p_product_id
    for update;
    next_stock := current_stock + p_quantity_change;
    if next_stock < 0 then
      raise exception 'Stock cannot go below zero.';
    end if;
    update public.products
    set stock = next_stock
    where id = p_product_id;
  end if;

  insert into public.inventory_movements (
    product_id,
    variation_id,
    movement_type,
    quantity_change,
    stock_after,
    reference_type,
    actor_id
  ) values (
    p_product_id,
    p_variation_id,
    case when p_quantity_change > 0 then 'restock' else 'adjustment' end,
    p_quantity_change,
    next_stock,
    nullif(trim(p_reason), ''),
    p_actor_id
  );

  return next_stock;
end;
$$;

revoke all on function public.adjust_inventory(bigint, bigint, integer, uuid, text)
  from public, anon, authenticated;
grant execute on function public.adjust_inventory(bigint, bigint, integer, uuid, text)
  to service_role;
