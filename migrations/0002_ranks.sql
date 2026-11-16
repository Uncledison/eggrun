create table if not exists ranks (
  id         serial primary key,
  name       text not null,
  score      integer not null check (score > 0 and score <= 5000000),
  created_at timestamptz not null default now()
);

create unique index if not exists ranks_name_key on ranks (name);
create index if not exists ranks_score_idx on ranks (score desc);
