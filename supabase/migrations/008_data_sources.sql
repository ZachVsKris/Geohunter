begin;
create table if not exists public.data_sources (
 id text primary key,
 name text not null,
 description text not null,
 status text not null default 'planned' check(status in ('planned','active','importing','error')),
 last_import_at timestamptz,
 display_order integer not null default 0,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
insert into public.data_sources(id,name,description,status,display_order) values
 ('worldbank','World Bank','World Development Indicators and partner series distributed through the World Bank API.','active',10),
 ('faostat','FAOSTAT','Food, agriculture, livestock, production, and trade statistics.','planned',20),
 ('unesco','UNESCO','Education, research, science, and culture statistics.','planned',30),
 ('who','WHO','Global health, mortality, disease, and health-system indicators.','planned',40),
 ('untourism','UN Tourism','International tourism arrivals, receipts, and related measures.','planned',50)
on conflict(id) do update set name=excluded.name,description=excluded.description,display_order=excluded.display_order;
alter table public.data_sources enable row level security;
commit;
