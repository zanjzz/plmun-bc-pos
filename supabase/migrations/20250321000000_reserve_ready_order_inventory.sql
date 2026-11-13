alter table public.products
  add column if not exists reserved_stock integer not null default 0
    check (reserved_stock >= 0);

alter table public.product_variations
  add column if not exists reserved_stock integer not null default 0
    check (reserved_stock >= 0);

alter table public.orders
  add column if not exists inventory_reserved boolean not null default false;

-- Earlier versions deducted Ready for pickup orders immediately. Restore those
-- units to on-hand stock and represent them as reservations.
with ready_variations as (
  select item.variation_id, sum(item.quantity)::integer as quantity
  from public.order_items item
  join public.orders order_record on order_record.id = item.order_id
  where order_record.status = 'Ready for pickup'
    and item.variation_id is not null
  group by item.variation_id
)
update public.product_variations variation
set
  stock = variation.stock + ready.quantity,
  reserved_stock = variation.reserved_stock + ready.quantity
from ready_variations ready
where variation.id = ready.variation_id;

with ready_products as (
  select item.product_id, sum(item.quantity)::integer as quantity
  from public.order_items item
  join public.orders order_record on order_record.id = item.order_id
  where order_record.status = 'Ready for pickup'
    and item.variation_id is null
  group by item.product_id
)
update public.products product
set
  stock = product.stock + ready.quantity,
  reserved_stock = product.reserved_stock + ready.quantity
from ready_products ready
where product.id = ready.product_id;

update public.orders
set inventory_reserved = true
where status = 'Ready for pickup';

delete from public.inventory_movements movement
using public.orders order_record
where order_record.status = 'Ready for pickup'
  and movement.movement_type = 'online fulfillment'
  and movement.reference_type = 'order'
  and movement.reference_id = order_record.order_number;

create or replace function public.reserve_inventory(p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  requested record;
  available_stock integer;
  stock_after integer;
  results jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'No inventory items were supplied.';
  end if;

  for requested in
    select
      (value ->> 'productId')::bigint as product_id,
      nullif(value ->> 'variationId', '')::bigint as variation_id,
      sum((value ->> 'quantity')::integer)::integer as quantity
    from jsonb_array_elements(p_items)
    group by 1, 2
    order by 1, 2 nulls first
  loop
    available_stock := null;
    if requested.variation_id is not null then
      select variation.stock - variation.reserved_stock
      into available_stock
      from public.product_variations variation
      join public.products product on product.id = variation.product_id
      where variation.id = requested.variation_id
        and variation.product_id = requested.product_id
        and variation.active = true
        and product.active = true
        and product.product_type = 'variable'
      for update of variation;
    else
      select product.stock - product.reserved_stock
      into available_stock
      from public.products product
      where product.id = requested.product_id
        and product.active = true
        and product.product_type = 'simple'
      for update;
    end if;

    if available_stock is null or requested.quantity <= 0 or available_stock < requested.quantity then
      raise exception 'Insufficient available stock for product %.', requested.product_id;
    end if;

    if requested.variation_id is not null then
      update public.product_variations
      set stock = stock - requested.quantity
      where id = requested.variation_id
      returning stock into stock_after;
    else
      update public.products
      set stock = stock - requested.quantity
      where id = requested.product_id
      returning stock into stock_after;
    end if;

    results := results || jsonb_build_array(jsonb_build_object(
      'productId', requested.product_id,
      'variationId', requested.variation_id,
      'stockAfter', stock_after
    ));
  end loop;
  return results;
end;
$$;

create or replace function public.reserve_order_inventory(
  p_order_id uuid,
  p_items jsonb,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  requested record;
  available_stock integer;
  already_reserved boolean;
  current_status text;
begin
  select inventory_reserved, status into already_reserved, current_status
  from public.orders
  where id = p_order_id
  for update;
  if already_reserved and current_status = 'Ready for pickup' then
    return;
  end if;
  if current_status is distinct from 'Confirmed' then
    raise exception 'Only confirmed orders can reserve inventory.';
  end if;

  for requested in
    select
      (value ->> 'productId')::bigint as product_id,
      nullif(value ->> 'variationId', '')::bigint as variation_id,
      sum((value ->> 'quantity')::integer)::integer as quantity
    from jsonb_array_elements(p_items)
    group by 1, 2
    order by 1, 2 nulls first
  loop
    available_stock := null;
    if requested.variation_id is not null then
      select stock - reserved_stock into available_stock
      from public.product_variations
      where id = requested.variation_id
        and product_id = requested.product_id
        and active = true
      for update;
      if available_stock is null or available_stock < requested.quantity then
        raise exception 'Insufficient stock for product variation.';
      end if;
      update public.product_variations
      set reserved_stock = reserved_stock + requested.quantity
      where id = requested.variation_id;
    else
      select stock - reserved_stock into available_stock
      from public.products
      where id = requested.product_id and active = true and product_type = 'simple'
      for update;
      if available_stock is null or available_stock < requested.quantity then
        raise exception 'Insufficient stock for product.';
      end if;
      update public.products
      set reserved_stock = reserved_stock + requested.quantity
      where id = requested.product_id;
    end if;
  end loop;
  update public.orders
  set
    inventory_reserved = true,
    status = 'Ready for pickup',
    status_message = p_message
  where id = p_order_id;
end;
$$;

create or replace function public.release_order_inventory(
  p_order_id uuid,
  p_items jsonb,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  requested record;
  current_status text;
  has_reservation boolean;
begin
  select status, inventory_reserved into current_status, has_reservation
  from public.orders where id = p_order_id for update;
  if current_status is distinct from 'Ready for pickup'
    or not coalesce(has_reservation, false) then
    raise exception 'This order does not have reserved inventory.';
  end if;
  for requested in
    select
      (value ->> 'productId')::bigint as product_id,
      nullif(value ->> 'variationId', '')::bigint as variation_id,
      sum((value ->> 'quantity')::integer)::integer as quantity
    from jsonb_array_elements(p_items)
    group by 1, 2
  loop
    if requested.variation_id is not null then
      update public.product_variations
      set reserved_stock = reserved_stock - requested.quantity
      where id = requested.variation_id and reserved_stock >= requested.quantity;
    else
      update public.products
      set reserved_stock = reserved_stock - requested.quantity
      where id = requested.product_id and reserved_stock >= requested.quantity;
    end if;
    if not found then
      raise exception 'Reserved inventory could not be released.';
    end if;
  end loop;
  update public.orders
  set
    inventory_reserved = false,
    status = 'Cancelled',
    status_message = p_message
  where id = p_order_id;
end;
$$;

create or replace function public.fulfill_order_inventory(
  p_order_id uuid,
  p_items jsonb,
  p_message text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  requested record;
  stock_after integer;
  results jsonb := '[]'::jsonb;
  has_reservation boolean;
  current_status text;
begin
  select inventory_reserved, status into has_reservation, current_status
  from public.orders
  where id = p_order_id
  for update;
  if current_status is distinct from 'Ready for pickup'
    or not coalesce(has_reservation, false) then
    raise exception 'This order does not have reserved inventory.';
  end if;

  for requested in
    select
      (value ->> 'productId')::bigint as product_id,
      nullif(value ->> 'variationId', '')::bigint as variation_id,
      sum((value ->> 'quantity')::integer)::integer as quantity
    from jsonb_array_elements(p_items)
    group by 1, 2
    order by 1, 2 nulls first
  loop
    stock_after := null;
    if requested.variation_id is not null then
      update public.product_variations
      set stock = stock - requested.quantity,
          reserved_stock = reserved_stock - requested.quantity
      where id = requested.variation_id
        and product_id = requested.product_id
        and stock >= requested.quantity
        and reserved_stock >= requested.quantity
      returning stock into stock_after;
    else
      update public.products
      set stock = stock - requested.quantity,
          reserved_stock = reserved_stock - requested.quantity
      where id = requested.product_id
        and stock >= requested.quantity
        and reserved_stock >= requested.quantity
      returning stock into stock_after;
    end if;
    if stock_after is null then
      raise exception 'Reserved inventory could not be fulfilled.';
    end if;
    results := results || jsonb_build_array(jsonb_build_object(
      'productId', requested.product_id,
      'variationId', requested.variation_id,
      'stockAfter', stock_after
    ));
  end loop;
  update public.orders
  set
    inventory_reserved = false,
    status = 'Completed',
    status_message = p_message
  where id = p_order_id;
  return results;
end;
$$;

create or replace function public.undo_order_fulfillment(
  p_order_id uuid,
  p_items jsonb,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  requested record;
begin
  perform 1 from public.orders where id = p_order_id for update;
  for requested in
    select
      (value ->> 'productId')::bigint as product_id,
      nullif(value ->> 'variationId', '')::bigint as variation_id,
      sum((value ->> 'quantity')::integer)::integer as quantity
    from jsonb_array_elements(p_items)
    group by 1, 2
  loop
    if requested.variation_id is not null then
      update public.product_variations
      set stock = stock + requested.quantity,
          reserved_stock = reserved_stock + requested.quantity
      where id = requested.variation_id;
    else
      update public.products
      set stock = stock + requested.quantity,
          reserved_stock = reserved_stock + requested.quantity
      where id = requested.product_id;
    end if;
  end loop;
  update public.orders
  set
    inventory_reserved = true,
    status = 'Ready for pickup',
    status_message = p_message
  where id = p_order_id;
end;
$$;

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
  current_reserved integer;
  next_stock integer;
  current_type text;
begin
  select product_type into current_type
  from public.products
  where id = p_product_id and active = true
  for update;

  if current_type is null or p_quantity_change = 0 then
    raise exception 'Invalid inventory adjustment.';
  end if;

  if current_type = 'variable' then
    select stock, reserved_stock into current_stock, current_reserved
    from public.product_variations
    where id = p_variation_id and product_id = p_product_id
    for update;
    if current_stock is null then
      raise exception 'Product variation not found.';
    end if;
    next_stock := current_stock + p_quantity_change;
    if next_stock < current_reserved then
      raise exception 'Stock cannot be reduced below the reserved quantity.';
    end if;
    update public.product_variations set stock = next_stock where id = p_variation_id;
  else
    if p_variation_id is not null then
      raise exception 'This product does not use variations.';
    end if;
    select stock, reserved_stock into current_stock, current_reserved
    from public.products where id = p_product_id;
    next_stock := current_stock + p_quantity_change;
    if next_stock < current_reserved then
      raise exception 'Stock cannot be reduced below the reserved quantity.';
    end if;
    update public.products set stock = next_stock where id = p_product_id;
  end if;

  insert into public.inventory_movements (
    product_id, variation_id, movement_type, quantity_change,
    stock_after, reference_type, actor_id
  ) values (
    p_product_id, p_variation_id,
    case when p_quantity_change > 0 then 'restock' else 'adjustment' end,
    p_quantity_change, next_stock, p_reason, p_actor_id
  );
  return next_stock;
end;
$$;

revoke all on function public.reserve_order_inventory(uuid, jsonb, text)
  from public, anon, authenticated;
revoke all on function public.release_order_inventory(uuid, jsonb, text)
  from public, anon, authenticated;
revoke all on function public.fulfill_order_inventory(uuid, jsonb, text)
  from public, anon, authenticated;
revoke all on function public.undo_order_fulfillment(uuid, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.reserve_order_inventory(uuid, jsonb, text) to service_role;
grant execute on function public.release_order_inventory(uuid, jsonb, text) to service_role;
grant execute on function public.fulfill_order_inventory(uuid, jsonb, text) to service_role;
grant execute on function public.undo_order_fulfillment(uuid, jsonb, text) to service_role;
