-- Modelo de referência PostgreSQL. Adaptar nomes/IDs ao provedor escolhido.
create extension if not exists pgcrypto;
create table dream_entries (
  id text primary key,
  slug text not null unique,
  title text not null,
  source_type text not null check (source_type in ('pdf_literal','editorial')),
  source_pdf_page integer,
  source_print_page integer,
  meaning text,
  related_pdf_id text references dream_entries(id),
  review_status text not null default 'draft' check (review_status in ('draft','reviewed','published')),
  reviewer_id uuid,
  reviewed_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  check (source_type <> 'pdf_literal' or source_pdf_page is not null),
  check (source_type <> 'editorial' or related_pdf_id is not null)
);
create table number_associations (
  entry_id text primary key references dream_entries(id) on delete cascade,
  animal text not null, group_number integer check (group_number between 1 and 25),
  dezena char(2), centena char(3), milhar char(4),
  evidence_pdf_page integer not null,
  check (dezena is null or dezena ~ '^[0-9]{2}$'),
  check (centena is null or centena ~ '^[0-9]{3}$'),
  check (milhar is null or milhar ~ '^[0-9]{4}$')
);
create table entry_aliases (
  id bigserial primary key,
  entry_id text not null references dream_entries(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  status text not null default 'draft',
  unique(entry_id,normalized_alias)
);
create index on entry_aliases(normalized_alias);
create table book_pages (
  pdf_page integer primary key,
  print_page integer,
  storage_key text not null,
  ocr_text text,
  review_status text not null default 'draft'
);
create table entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  buyer_email text not null,
  offer_id text not null,
  product_key text not null check (product_key in ('book_pdf','book_app','federal_addon')),
  payment_id text not null unique,
  status text not null check (status in ('pending','active','revoked')),
  granted_at timestamptz,
  revoked_at timestamptz
);
create index on entitlements(lower(buyer_email),product_key,status);
create table payment_events (
  provider_event_id text primary key,
  payment_id text,
  payload_hash text not null,
  event_type text not null,
  processed_at timestamptz not null default now()
);
create table catalog_items (
  id uuid primary key default gen_random_uuid(),
  value text not null,
  value_kind text not null check (value_kind in ('centena','milhar')),
  source_name text not null,
  methodology text not null,
  reference_period text,
  review_status text not null default 'draft',
  version integer not null default 1
);
create table saved_entries (
  user_id uuid not null,
  entry_id text not null references dream_entries(id),
  saved_at timestamptz not null default now(),
  primary key(user_id,entry_id)
);
-- Habilitar RLS por tabela antes de disponibilizar o banco à aplicação.
-- Políticas: leitura pública autenticada apenas de entradas publicadas; salvos
-- apenas ao dono; entitlements apenas ao dono; escritas de curadoria e pagamentos
-- exclusivamente no servidor, usando chaves secretas nunca expostas ao cliente.
