-- Run once in the Supabase SQL editor. Every table is owned by the signed-in user.
create extension if not exists pgcrypto;

create table if not exists semesters (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0), academic_year text not null,
  start_date date not null, end_date date not null check (end_date >= start_date),
  is_active boolean not null default false, is_demo boolean not null default false,
  created_at timestamptz not null default now(), unique (id, user_id)
);
create unique index if not exists one_active_semester_per_user on semesters(user_id) where is_active;
create index if not exists semesters_user_dates on semesters(user_id, start_date desc);

create table if not exists courses (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  semester_id uuid not null, code text not null check (length(trim(code)) > 0),
  name text not null check (length(trim(name)) > 0), credits numeric(4,1) not null check (credits >= 0 and credits <= 30),
  instructor text, section text, location text, color text not null default '#477a77',
  final_grade text check (final_grade in ('A','A-','B+','B','B-','C+','C','C-','D','F','XF','WF','AUD','AW','I','IP','N','P','TR','W','WV')),
  is_demo boolean not null default false, created_at timestamptz not null default now(),
  unique (id, user_id), foreign key (semester_id, user_id) references semesters(id, user_id) on delete cascade,
  unique (user_id, semester_id, code, section)
);
create index if not exists courses_user_semester on courses(user_id, semester_id);

create table if not exists meetings (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null, day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null, end_time time not null check (end_time > start_time), location text,
  is_demo boolean not null default false, unique (id, user_id),
  foreign key (course_id, user_id) references courses(id, user_id) on delete cascade
);
create index if not exists meetings_user_day on meetings(user_id, day_of_week, start_time);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null, name text not null check (length(trim(name)) > 0),
  weight numeric(5,2) not null check (weight >= 0 and weight <= 100), is_demo boolean not null default false,
  unique (id, user_id), unique (id, user_id, course_id), foreign key (course_id, user_id) references courses(id, user_id) on delete cascade,
  unique (course_id, name)
);
create index if not exists categories_user_course on categories(user_id, course_id);

create or replace function enforce_category_total() returns trigger
language plpgsql security invoker set search_path = public as $$
declare total numeric;
begin
  select coalesce(sum(weight),0) into total from categories where course_id = new.course_id and user_id = new.user_id and id <> new.id;
  if total + new.weight > 100 then raise exception 'Grade category weights cannot exceed 100%% per course'; end if;
  return new;
end $$;
create constraint trigger categories_total after insert or update on categories deferrable initially deferred for each row execute function enforce_category_total();

create table if not exists items (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null, title text not null check (length(trim(title)) > 0),
  kind text not null check (kind in ('assignment','quiz','midterm','final','practical','lab','project','participation','other')),
  description text, due_at timestamptz, starts_at timestamptz, ends_at timestamptz,
  location text, topics text, status text not null default 'not_started' check (status in ('not_started','in_progress','completed')),
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  category_id uuid, score numeric(8,2), max_score numeric(8,2),
  is_demo boolean not null default false, created_at timestamptz not null default now(),
  unique (id, user_id), foreign key (course_id, user_id) references courses(id, user_id) on delete cascade,
  foreign key (category_id, user_id, course_id) references categories(id, user_id, course_id) on delete set null (category_id),
  check (ends_at is null or starts_at is not null and ends_at > starts_at),
  check (score is null or max_score is not null and score >= 0 and score <= max_score),
  check (max_score is null or max_score > 0)
);
create index if not exists items_user_due on items(user_id, due_at);
create index if not exists items_user_start on items(user_id, starts_at);
create index if not exists items_user_course on items(user_id, course_id);

create table if not exists notes (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  semester_id uuid, course_id uuid, title text not null check (length(trim(title)) > 0),
  content text not null default '', pinned boolean not null default false, is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (id, user_id), foreign key (semester_id, user_id) references semesters(id, user_id) on delete set null (semester_id),
  foreign key (course_id, user_id) references courses(id, user_id) on delete set null (course_id)
);
create index if not exists notes_user_updated on notes(user_id, pinned desc, updated_at desc);

create table if not exists events (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  semester_id uuid, title text not null check (length(trim(title)) > 0), description text,
  starts_at timestamptz not null, ends_at timestamptz, location text, is_demo boolean not null default false,
  unique (id, user_id), foreign key (semester_id, user_id) references semesters(id, user_id) on delete set null (semester_id),
  check (ends_at is null or ends_at > starts_at)
);
create index if not exists events_user_start on events(user_id, starts_at);

create table if not exists user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'system' check (theme in ('light','dark','system')),
  grade_scale jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table semesters enable row level security;
alter table courses enable row level security;
alter table meetings enable row level security;
alter table categories enable row level security;
alter table items enable row level security;
alter table notes enable row level security;
alter table events enable row level security;
alter table user_settings enable row level security;

revoke all on semesters,courses,meetings,categories,items,notes,events,user_settings from anon;
grant select,insert,update,delete on semesters,courses,meetings,categories,items,notes,events,user_settings to authenticated;

do $$ declare t text; begin
  foreach t in array array['semesters','courses','meetings','categories','items','notes','events','user_settings'] loop
    execute format('create policy "owner can read" on %I for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format('create policy "owner can insert" on %I for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format('create policy "owner can update" on %I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('create policy "owner can delete" on %I for delete to authenticated using (user_id = (select auth.uid()))', t);
  end loop;
end $$;

create or replace function set_active_semester(target_id uuid) returns void
language plpgsql security invoker set search_path = public as $$
begin
  if not exists (select 1 from semesters where id = target_id and user_id = auth.uid()) then
    raise exception 'Semester not found';
  end if;
  update semesters set is_active = false where user_id = auth.uid() and is_active;
  update semesters set is_active = true where id = target_id and user_id = auth.uid();
end $$;
revoke all on function set_active_semester(uuid) from public;
grant execute on function set_active_semester(uuid) to authenticated;

-- PostgreSQL functions execute atomically. The function always supplies auth.uid()
-- and runs with the caller's RLS permissions; imported user_id values are ignored.
create or replace function restore_backup(backup jsonb, import_mode text) returns void
language plpgsql security invoker set search_path = public as $$
declare owner_id uuid := auth.uid(); previous_active uuid;
begin
  if owner_id is null then raise exception 'Sign in to import a backup'; end if;
  if import_mode not in ('merge','replace') then raise exception 'Invalid import mode'; end if;
  if (backup->>'version')::int <> 1 then raise exception 'Unsupported backup version'; end if;
  if jsonb_typeof(backup->'data') <> 'object' then raise exception 'Invalid backup data'; end if;
  select id into previous_active from semesters where user_id = owner_id and is_active limit 1;
  if import_mode = 'replace' then
    delete from events where user_id = owner_id;
    delete from notes where user_id = owner_id;
    delete from semesters where user_id = owner_id;
    delete from user_settings where user_id = owner_id;
  end if;
  insert into semesters (id,user_id,name,academic_year,start_date,end_date,is_active,is_demo,created_at)
  select id,owner_id,name,academic_year,start_date,end_date,false,coalesce(is_demo,false),coalesce(created_at,now())
  from jsonb_to_recordset(backup->'data'->'semesters') as x(id uuid,name text,academic_year text,start_date date,end_date date,is_demo boolean,created_at timestamptz)
  on conflict (id) do update set name=excluded.name,academic_year=excluded.academic_year,start_date=excluded.start_date,end_date=excluded.end_date,is_demo=excluded.is_demo;
  insert into courses (id,user_id,semester_id,code,name,credits,instructor,section,location,color,final_grade,is_demo,created_at)
  select id,owner_id,semester_id,code,name,credits,instructor,section,location,coalesce(color,'#477a77'),final_grade,coalesce(is_demo,false),coalesce(created_at,now())
  from jsonb_to_recordset(backup->'data'->'courses') as x(id uuid,semester_id uuid,code text,name text,credits numeric,instructor text,section text,location text,color text,final_grade text,is_demo boolean,created_at timestamptz)
  on conflict (id) do update set semester_id=excluded.semester_id,code=excluded.code,name=excluded.name,credits=excluded.credits,instructor=excluded.instructor,section=excluded.section,location=excluded.location,color=excluded.color,final_grade=excluded.final_grade,is_demo=excluded.is_demo;
  insert into meetings (id,user_id,course_id,day_of_week,start_time,end_time,location,is_demo)
  select id,owner_id,course_id,day_of_week,start_time,end_time,location,coalesce(is_demo,false)
  from jsonb_to_recordset(backup->'data'->'meetings') as x(id uuid,course_id uuid,day_of_week smallint,start_time time,end_time time,location text,is_demo boolean)
  on conflict (id) do update set course_id=excluded.course_id,day_of_week=excluded.day_of_week,start_time=excluded.start_time,end_time=excluded.end_time,location=excluded.location,is_demo=excluded.is_demo;
  insert into categories (id,user_id,course_id,name,weight,is_demo)
  select id,owner_id,course_id,name,weight,coalesce(is_demo,false)
  from jsonb_to_recordset(backup->'data'->'categories') as x(id uuid,course_id uuid,name text,weight numeric,is_demo boolean)
  on conflict (id) do update set course_id=excluded.course_id,name=excluded.name,weight=excluded.weight,is_demo=excluded.is_demo;
  insert into items (id,user_id,course_id,title,kind,description,due_at,starts_at,ends_at,location,topics,status,priority,category_id,score,max_score,is_demo,created_at)
  select id,owner_id,course_id,title,kind,description,due_at,starts_at,ends_at,location,topics,coalesce(status,'not_started'),coalesce(priority,'medium'),category_id,score,max_score,coalesce(is_demo,false),coalesce(created_at,now())
  from jsonb_to_recordset(backup->'data'->'items') as x(id uuid,course_id uuid,title text,kind text,description text,due_at timestamptz,starts_at timestamptz,ends_at timestamptz,location text,topics text,status text,priority text,category_id uuid,score numeric,max_score numeric,is_demo boolean,created_at timestamptz)
  on conflict (id) do update set course_id=excluded.course_id,title=excluded.title,kind=excluded.kind,description=excluded.description,due_at=excluded.due_at,starts_at=excluded.starts_at,ends_at=excluded.ends_at,location=excluded.location,topics=excluded.topics,status=excluded.status,priority=excluded.priority,category_id=excluded.category_id,score=excluded.score,max_score=excluded.max_score,is_demo=excluded.is_demo;
  insert into notes (id,user_id,semester_id,course_id,title,content,pinned,is_demo,created_at,updated_at)
  select id,owner_id,semester_id,course_id,title,coalesce(content,''),coalesce(pinned,false),coalesce(is_demo,false),coalesce(created_at,now()),coalesce(updated_at,now())
  from jsonb_to_recordset(backup->'data'->'notes') as x(id uuid,semester_id uuid,course_id uuid,title text,content text,pinned boolean,is_demo boolean,created_at timestamptz,updated_at timestamptz)
  on conflict (id) do update set semester_id=excluded.semester_id,course_id=excluded.course_id,title=excluded.title,content=excluded.content,pinned=excluded.pinned,is_demo=excluded.is_demo,updated_at=excluded.updated_at;
  insert into events (id,user_id,semester_id,title,description,starts_at,ends_at,location,is_demo)
  select id,owner_id,semester_id,title,description,starts_at,ends_at,location,coalesce(is_demo,false)
  from jsonb_to_recordset(backup->'data'->'events') as x(id uuid,semester_id uuid,title text,description text,starts_at timestamptz,ends_at timestamptz,location text,is_demo boolean)
  on conflict (id) do update set semester_id=excluded.semester_id,title=excluded.title,description=excluded.description,starts_at=excluded.starts_at,ends_at=excluded.ends_at,location=excluded.location,is_demo=excluded.is_demo;
  if backup->'data'->'settings' is not null and backup->'data'->'settings' <> 'null'::jsonb then
    insert into user_settings(user_id,theme,grade_scale,updated_at)
    values(owner_id,coalesce(backup->'data'->'settings'->>'theme','system'),coalesce(backup->'data'->'settings'->'grade_scale','{}'::jsonb),now())
    on conflict (user_id) do update set theme=excluded.theme,grade_scale=excluded.grade_scale,updated_at=now();
  end if;
  update semesters set is_active = false where user_id = owner_id and is_active;
  update semesters set is_active = true where user_id = owner_id and id = coalesce(case when import_mode = 'merge' then previous_active end, nullif(backup->>'activeSemesterId','')::uuid);
end $$;
revoke all on function restore_backup(jsonb,text) from public;
grant execute on function restore_backup(jsonb,text) to authenticated;

create or replace function remove_demo_data() returns void
language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in to remove demo data'; end if;
  if exists (select 1 from courses c join semesters s on s.id=c.semester_id where c.user_id=auth.uid() and s.is_demo and not c.is_demo)
    or exists (select 1 from meetings m join courses c on c.id=m.course_id where m.user_id=auth.uid() and c.is_demo and not m.is_demo)
    or exists (select 1 from categories g join courses c on c.id=g.course_id where g.user_id=auth.uid() and c.is_demo and not g.is_demo)
    or exists (select 1 from items i join courses c on c.id=i.course_id where i.user_id=auth.uid() and c.is_demo and not i.is_demo)
    or exists (select 1 from notes n where n.user_id=auth.uid() and not n.is_demo and (n.semester_id in (select id from semesters where user_id=auth.uid() and is_demo) or n.course_id in (select id from courses where user_id=auth.uid() and is_demo)))
    or exists (select 1 from events e where e.user_id=auth.uid() and not e.is_demo and e.semester_id in (select id from semesters where user_id=auth.uid() and is_demo))
  then raise exception 'Move or remove real records linked to demo data before deleting the demo set'; end if;
  delete from events where user_id=auth.uid() and is_demo;
  delete from notes where user_id=auth.uid() and is_demo;
  delete from items where user_id=auth.uid() and is_demo;
  delete from meetings where user_id=auth.uid() and is_demo;
  delete from categories where user_id=auth.uid() and is_demo;
  delete from courses where user_id=auth.uid() and is_demo;
  delete from semesters where user_id=auth.uid() and is_demo;
end $$;
revoke all on function remove_demo_data() from public;
grant execute on function remove_demo_data() to authenticated;
