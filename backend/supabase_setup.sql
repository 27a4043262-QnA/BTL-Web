-- EduTrack: chạy một lần trong Supabase SQL Editor.
-- Yêu cầu đã kích hoạt Supabase Auth (email magic link).
-- Không đặt secret/service_role key vào frontend.
create extension if not exists pgcrypto;

create table if not exists public.course_reviews (
  id uuid primary key default gen_random_uuid(),
  course_id text not null check(course_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  author_name text not null default 'Người học' check(char_length(trim(author_name)) between 2 and 80),
  content text not null check(char_length(trim(content)) between 10 and 500),
  created_at timestamptz not null default now()
);
create index if not exists reviews_course_date_idx on public.course_reviews(course_id,created_at desc);
alter table public.course_reviews enable row level security;

-- Tên tác giả lấy từ user metadata của phiên Auth, KHÔNG lấy từ trường client.
create or replace function public.et_review_name()
returns trigger language plpgsql security definer set search_path=public,auth as $$
begin
  new.user_id := auth.uid();
  new.author_name := coalesce(nullif(trim(auth.jwt()->'user_metadata'->>'full_name'),''),'Người học');
  if char_length(trim(new.author_name)) < 2 then raise exception 'Bạn cần cập nhật họ tên trước khi gửi nhận xét.'; end if;
  return new;
end $$;
drop trigger if exists et_reviews_autoname on public.course_reviews;
create trigger et_reviews_autoname before insert on public.course_reviews
for each row execute function public.et_review_name();

create table if not exists public.course_questions (
  id uuid primary key default gen_random_uuid(),
  course_id text not null check(course_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  content text not null check(char_length(trim(content)) between 10 and 500),
  status text not null default 'pending' check(status in ('pending','answered')),
  answer text check(answer is null or char_length(trim(answer)) between 3 and 5000),
  created_at timestamptz not null default now(),
  answered_at timestamptz
);
create index if not exists questions_status_date_idx on public.course_questions(status,created_at desc);
alter table public.course_questions enable row level security;

-- Nếu từng chạy SQL đời cũ: dọn policy cũ để tránh anonymous insert.
drop policy if exists reviews_public_read on public.course_reviews;
drop policy if exists reviews_public_insert on public.course_reviews;
drop policy if exists questions_public_insert on public.course_questions;
drop policy if exists questions_advisor_select on public.course_questions;
drop policy if exists questions_advisor_update on public.course_questions;
drop policy if exists et_reviews_read on public.course_reviews;
drop policy if exists et_reviews_insert on public.course_reviews;
drop policy if exists et_reviews_delete on public.course_reviews;
drop policy if exists et_questions_insert on public.course_questions;
drop policy if exists et_questions_select on public.course_questions;
drop policy if exists et_questions_answer on public.course_questions;

revoke all on public.course_reviews from anon, authenticated;
revoke all on public.course_questions from anon, authenticated;
grant usage on schema public to anon,authenticated;
grant select on public.course_reviews to anon, authenticated;
grant insert(course_id,content) on public.course_reviews to authenticated;
grant delete on public.course_reviews to authenticated;
grant insert(course_id,content) on public.course_questions to authenticated;
grant select,update on public.course_questions to authenticated;

create policy et_reviews_read on public.course_reviews for select to anon,authenticated using(true);
create policy et_reviews_insert on public.course_reviews for insert to authenticated
  with check(auth.uid() = user_id);
create policy et_reviews_delete on public.course_reviews for delete to authenticated
  using(auth.uid() = user_id);
create policy et_questions_insert on public.course_questions for insert to authenticated
  with check(auth.uid() = user_id and status='pending' and answer is null);
create policy et_questions_select on public.course_questions for select to authenticated
  using((auth.jwt()->'app_metadata'->>'role') in ('advisor','admin') or user_id=auth.uid());
create policy et_questions_answer on public.course_questions for update to authenticated
  using((auth.jwt()->'app_metadata'->>'role') in ('advisor','admin'))
  with check((auth.jwt()->'app_metadata'->>'role') in ('advisor','admin'));

-- Phân quyền role advisor/admin qua app_metadata do người quản trị thiết lập.
-- Trước khi public: kiểm thử RLS bằng 2 tài khoản và cân nhắc rate limit/CAPTCHA.
