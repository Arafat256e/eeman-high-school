-- Eeman High School website CMS schema.
-- This script creates ehs_* tables and does not drop or overwrite existing tables.
create extension if not exists pgcrypto;

create table if not exists public.ehs_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create or replace function public.ehs_is_admin() returns boolean
language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.ehs_admins where user_id = auth.uid()); $$;
grant execute on function public.ehs_is_admin() to anon, authenticated;

create table if not exists public.ehs_site_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);
create table if not exists public.ehs_programs (
  id uuid primary key default gen_random_uuid(), title text not null, level text not null default '', description text not null default '',
  display_order integer not null default 0, published boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.ehs_news_events (
  id uuid primary key default gen_random_uuid(), title text not null, category text not null default 'News', event_date date,
  body text not null default '', image_url text, published boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.ehs_staff (
  id uuid primary key default gen_random_uuid(), name text not null, role text not null default '', bio text not null default '', image_url text,
  display_order integer not null default 0, published boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.ehs_gallery (
  id uuid primary key default gen_random_uuid(), caption text not null default '', image_url text not null,
  display_order integer not null default 0, published boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.ehs_testimonials (
  id uuid primary key default gen_random_uuid(), person_name text not null, relationship text not null default '', quote text not null,
  display_order integer not null default 0, published boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.ehs_faqs (
  id uuid primary key default gen_random_uuid(), question text not null, answer text not null,
  display_order integer not null default 0, published boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.ehs_contact_inquiries (
  id uuid primary key default gen_random_uuid(), name text not null, email text not null, subject text not null, message text not null,
  created_at timestamptz not null default now()
);

alter table public.ehs_admins enable row level security;
alter table public.ehs_site_settings enable row level security;
alter table public.ehs_programs enable row level security;
alter table public.ehs_news_events enable row level security;
alter table public.ehs_staff enable row level security;
alter table public.ehs_gallery enable row level security;
alter table public.ehs_testimonials enable row level security;
alter table public.ehs_faqs enable row level security;
alter table public.ehs_contact_inquiries enable row level security;

-- Admin membership may only be managed by project owners in the Supabase dashboard.
drop policy if exists "ehs admin can read own membership" on public.ehs_admins;
create policy "ehs admin can read own membership" on public.ehs_admins for select to authenticated using (user_id = auth.uid());

-- Published content is publicly readable; only explicitly authorised admins can manage it.
do $$ declare t text; begin
 foreach t in array array['ehs_site_settings','ehs_programs','ehs_news_events','ehs_staff','ehs_gallery','ehs_testimonials','ehs_faqs'] loop
   execute format('drop policy if exists %I on public.%I', t||'_public_read', t);
   if t='ehs_site_settings' then
     execute format('create policy %I on public.%I for select to anon, authenticated using (true)', t||'_public_read',t);
   else
     execute format('create policy %I on public.%I for select to anon, authenticated using (published = true)', t||'_public_read',t);
   end if;
   execute format('drop policy if exists %I on public.%I', t||'_admin_manage', t);
   execute format('create policy %I on public.%I for all to authenticated using (public.ehs_is_admin()) with check (public.ehs_is_admin())', t||'_admin_manage',t);
 end loop;
end $$;

-- Anyone can send an enquiry; only admins can read or delete enquiries.
drop policy if exists "ehs inquiries public submit" on public.ehs_contact_inquiries;
create policy "ehs inquiries public submit" on public.ehs_contact_inquiries for insert to anon, authenticated with check (length(name) between 1 and 120 and length(email) between 3 and 200 and length(subject) between 1 and 180 and length(message) between 1 and 3000);
drop policy if exists "ehs inquiries admin read" on public.ehs_contact_inquiries;
create policy "ehs inquiries admin read" on public.ehs_contact_inquiries for select to authenticated using (public.ehs_is_admin());
drop policy if exists "ehs inquiries admin delete" on public.ehs_contact_inquiries;
create policy "ehs inquiries admin delete" on public.ehs_contact_inquiries for delete to authenticated using (public.ehs_is_admin());

-- Public image bucket. Admin-only uploads/deletes. Object URLs are public for published website images.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ehs-media','ehs-media',true,8388608,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = true, file_size_limit = 8388608, allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif'];
drop policy if exists "ehs media public view" on storage.objects;
create policy "ehs media public view" on storage.objects for select to anon, authenticated using (bucket_id = 'ehs-media');
drop policy if exists "ehs media admin upload" on storage.objects;
create policy "ehs media admin upload" on storage.objects for insert to authenticated with check (bucket_id = 'ehs-media' and public.ehs_is_admin());
drop policy if exists "ehs media admin update" on storage.objects;
create policy "ehs media admin update" on storage.objects for update to authenticated using (bucket_id = 'ehs-media' and public.ehs_is_admin()) with check (bucket_id = 'ehs-media' and public.ehs_is_admin());
drop policy if exists "ehs media admin delete" on storage.objects;
create policy "ehs media admin delete" on storage.objects for delete to authenticated using (bucket_id = 'ehs-media' and public.ehs_is_admin());

-- Starter content/settings. Existing values are retained on rerun.
insert into public.ehs_site_settings(key,value) values
('school_name_brand','Eeman High School'),('school_motto_brand','Educating for Human Greatness'),
('hero_eyebrow','WELCOME TO EEMAN HIGH SCHOOL'),('hero_title','Educating for |Human Greatness.'),
('hero_description','A welcoming learning community where knowledge, character and ambition come together to prepare every learner for a meaningful future.'),
('about_title','Growing minds. Shaping futures.'),('about_text','At Eeman High School, education is about more than examination results. We aim to nurture curious minds, responsible character and the confidence to contribute positively to society.'),
('contact_phone',''),('contact_email',''),('contact_address','')
on conflict(key) do nothing;
insert into public.ehs_programs(title,level,description,display_order,published)
select seed.title,seed.level,seed.description,seed.display_order,seed.published from (values
('O-Level','O-LEVEL','A broad foundation in essential subjects, study skills and independent thinking to prepare learners for their next stage.',1,true),
('A-Level Sciences','A-LEVEL SCIENCES','For learners interested in scientific inquiry, evidence-based thinking and pathways in science-related fields.',2,true),
('A-Level Arts','A-LEVEL ARTS','Develop analytical thinking, communication, creativity and a deeper understanding of people and society.',3,true)
) as seed(title,level,description,display_order,published)
where not exists (select 1 from public.ehs_programs p where p.title=seed.title);
