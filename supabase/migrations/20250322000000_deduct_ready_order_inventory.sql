-- Convert active reservations back into physical deductions for prepared orders.
insert into public.inventory_movements (
  product_id,
  variation_id,
  movement_type,
  quantity_change,
  stock_after,
  reference_type,
  reference_id
)
select
  item.product_id,
  item.variation_id,
  'online fulfillment',
  -item.quantity,
  case
    when item.variation_id is not null then variation.stock - variation.reserved_stock
    else product.stock - product.reserved_stock
  end,
  'order',
  order_record.order_number
from public.order_items item
join public.orders order_record on order_record.id = item.order_id
join public.products product on product.id = item.product_id
left join public.product_variations variation on variation.id = item.variation_id
where order_record.status = 'Ready for pickup'
  and order_record.inventory_reserved = true;

update public.product_variations
set
  stock = stock - reserved_stock,
  reserved_stock = 0
where reserved_stock > 0;

update public.products
set
  stock = stock - reserved_stock,
  reserved_stock = 0
where reserved_stock > 0;

update public.orders
set inventory_reserved = false
where inventory_reserved = true;

create or replace function public.deduct_ready_order_inventory(
  p_order_id uuid,
  p_items jsonb,
  p_message text,
  p_actor_id uuid,
  p_reference text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status text;
  requested record;
  reserved_results jsonb;
  result_item jsonb;
  stock_after integer;
begin
  select status into current_status
  from public.orders
  where id = p_order_id
  for update;

  if current_status = 'Ready for pickup' then
    return null;
  end if;
  if current_status is distinct from 'Confirmed' then
    raise exception 'Only confirmed orders can be prepared.';
  end if;

  reserved_results := public.reserve_inventory(p_items);

  for requested in
    select
      (value ->> 'productId')::bigint as product_id,
      nullif(value ->> 'variationId', '')::bigint as variation_id,
      sum((value ->> 'quantity')::integer)::integer as quantity
    from jsonb_array_elements(p_items)
    group by 1, 2
  loop
    select value into result_item
    from jsonb_array_elements(reserved_results)
    where (value ->> 'productId')::bigint = requested.product_id
      and coalesce((value ->> 'variationId')::bigint, 0)
        = coalesce(requested.variation_id, 0);
    stock_after := (result_item ->> 'stockAfter')::integer;

    insert into public.inventory_movements (
      product_id,
      variation_id,
      movement_type,
      quantity_change,
      stock_after,
      reference_type,
      reference_id,
      actor_id
    ) values (
      requested.product_id,
      requested.variation_id,
      'online fulfillment',
      -requested.quantity,
      stock_after,
      'order',
      p_reference,
      p_actor_id
    );
  end loop;

  update public.orders
  set
    status = 'Ready for pickup',
    status_message = p_message,
    inventory_reserved = false
  where id = p_order_id;

  return reserved_results;
end;
$$;

create or replace function public.cancel_ready_order_inventory(
  p_order_id uuid,
  p_items jsonb,
  p_message text,
  p_actor_id uuid,
  p_reference text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status text;
  requested record;
  stock_after integer;
begin
  select status into current_status
  from public.orders
  where id = p_order_id
  for update;

  if current_status is distinct from 'Ready for pickup' then
    raise exception 'Only prepared orders can return deducted inventory.';
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
    if requested.variation_id is not null then
      update public.product_variations
      set stock = stock + requested.quantity
      where id = requested.variation_id and product_id = requested.product_id
      returning stock into stock_after;
    else
      update public.products
      set stock = stock + requested.quantity
      where id = requested.product_id
      returning stock into stock_after;
    end if;
    if stock_after is null then
      raise exception 'Deducted inventory could not be returned.';
    end if;

    insert into public.inventory_movements (
      product_id,
      variation_id,
      movement_type,
      quantity_change,
      stock_after,
      reference_type,
      reference_id,
      actor_id
    ) values (
      requested.product_id,
      requested.variation_id,
      'return',
      requested.quantity,
      stock_after,
      'cancelled order',
      p_reference,
      p_actor_id
    );
  end loop;

  update public.orders
  set
    status = 'Cancelled',
    status_message = p_message,
    inventory_reserved = false
  where id = p_order_id;
end;
$$;

revoke all on function public.deduct_ready_order_inventory(uuid, jsonb, text, uuid, text)
  from public, anon, authenticated;
revoke all on function public.cancel_ready_order_inventory(uuid, jsonb, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.deduct_ready_order_inventory(uuid, jsonb, text, uuid, text)
  to service_role;
grant execute on function public.cancel_ready_order_inventory(uuid, jsonb, text, uuid, text)
  to service_role;
