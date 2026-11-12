create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  recipient_role text not null check (recipient_role in ('student', 'staff', 'admin')),
  event_key text not null,
  type text not null check (type in ('order', 'inventory', 'transaction', 'system')),
  title text not null,
  message text not null,
  action_page text,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (recipient_id, event_key)
);

create index if not exists notifications_recipient_created_idx
  on public.notifications(recipient_id, created_at desc);
create index if not exists notifications_recipient_unread_idx
  on public.notifications(recipient_id, read_at)
  where read_at is null;

alter table public.notifications enable row level security;
