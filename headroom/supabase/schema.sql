create table profiles (
  id text primary key,                       -- 'aisha'
  display_name text not null,
  language text not null default 'en',       -- en | ur | pl
  text_size text not null default 'normal',  -- normal | large
  whatsapp_to text,
  created_at timestamptz not null default now()
);

create table plans (
  id uuid primary key default gen_random_uuid(),
  profile_id text not null references profiles(id),
  action_ids text[] not null,
  lowest_before numeric not null,
  lowest_after numeric not null,
  lowest_date date not null,
  created_at timestamptz not null default now()
);

create table activity (
  id uuid primary key default gen_random_uuid(),
  profile_id text not null references profiles(id),
  kind text not null,      -- plan_created | message_sent | reminder_sent | handoff_sent | reset | error
  title text not null,     -- shown in the rail, e.g. "Plan sent by WhatsApp"
  detail text,
  source text not null,    -- app | n8n | fallback
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table plans enable row level security;
alter table activity enable row level security;
-- no policies: only the service key (server) reads and writes

insert into profiles (id, display_name) values ('aisha', 'Aisha');
