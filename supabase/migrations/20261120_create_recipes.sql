-- SamOS Kitchen — initial recipe storage
-- Apply once in the Supabase SQL Editor after reviewing it.
-- This creates a NEW table; it does not migrate, update, or delete existing recipes.
--
-- Source-of-truth documents in private hazel-maris/SamOS:
-- community-center/food-room/recipe-book/recipe-template.md
-- community-center/food-room/recipe-book/recipe-dictionary.md
-- community-center/food-room/instructions/chatgpt-recipe-instructions.md
--
-- NOTE: The older template/dictionary contain different status conventions.
-- The newer ChatGPT instructions explicitly define Generated → Ready → Tested → Final.
-- Preserve each imported recipe's source markdown and flag older/nonstandard
-- values for human review rather than silently promoting its status.

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null check (length(btrim(slug)) between 1 and 160),
  title text not null check (length(btrim(title)) between 1 and 250),

  -- The application sets status only through an explicit user action.
  -- The default is always unreviewed, never auto-verified by an importer.
  status text not null default 'Generated'
    check (status in ('Generated', 'Ready', 'Tested', 'Final')),
  difficulty text not null default 'Unknown'
    check (difficulty in ('Easy', 'Medium', 'Hard', 'Unknown', 'N/A')),
  category text not null default 'Unknown'
    check (category in (
      'Breakfast', 'Lunch', 'Dinner', 'Snackies & Appies',
      'Sides', 'Sauces, Spices & Condiments', 'Dessert', 'Drinks',
      'Bread', 'Soup', 'Unknown'
    )),

  -- Text preserves imprecise quantities/times rather than inventing numbers.
  servings text not null default 'Unknown',
  prep_time text not null default 'Unknown',
  cook_time text not null default 'Unknown',
  total_time text not null default 'Unknown',
  equipment text[] not null default '{}',
  tags text[] not null default '{}',
  meal_prep_friendly text not null default 'Unknown'
    check (meal_prep_friendly in ('Yes', 'No', 'Unknown', 'N/A')),
  freezer_friendly text not null default 'Unknown'
    check (freezer_friendly in ('Yes', 'No', 'Unknown', 'N/A')),
  last_cooked text not null default 'Unknown',
  author text not null default 'Unknown',
  sources text not null default 'Unknown',
  source_last_updated text not null default 'Unknown',

  -- Arrays of ordered text blocks, optionally grouped by subsection.
  -- E.g. [{"heading":"Sauce","items":["½ cup broth","salt, to taste"]}].
  -- The browser/importer must validate the contents before saving.
  ingredients jsonb not null default '[]'::jsonb
    check (jsonb_typeof(ingredients) = 'array'),
  steps jsonb not null default '[]'::jsonb
    check (jsonb_typeof(steps) = 'array'),

  -- Always preserve the four distinct storage methods from the template.
  storage jsonb not null default '{"room_temperature":"Unknown","refrigerated":"Unknown","frozen":"Unknown","canned":"Unknown"}'::jsonb
    check (jsonb_typeof(storage) = 'object'),

  -- Notes, canning guidance, variations, and miscellaneous sections remain
  -- exact Markdown, rather than losing nuanced instructions in conversion.
  notes_markdown text not null default '',
  canning_method_markdown text not null default '',

  -- Lossless backup of the original imported note (including attribution).
  original_markdown text,
  source_repo text,
  source_path text,
  review_flags text[] not null default '{}',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slug)
);

create index if not exists recipes_user_category_idx
  on public.recipes (user_id, category);
create index if not exists recipes_user_status_idx
  on public.recipes (user_id, status);
create index if not exists recipes_user_title_idx
  on public.recipes (user_id, title);

-- Enforce per-user ownership even for requests made from the public Hub.
alter table public.recipes enable row level security;

-- Explicit policies: each authenticated person can access only their rows.
-- Use separate checks for writes so a row cannot be reassigned to another user.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'recipes'
      and policyname = 'recipes_select_own'
  ) then
    create policy recipes_select_own on public.recipes
      for select to authenticated using ((select auth.uid()) = user_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'recipes'
      and policyname = 'recipes_insert_own'
  ) then
    create policy recipes_insert_own on public.recipes
      for insert to authenticated with check ((select auth.uid()) = user_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'recipes'
      and policyname = 'recipes_update_own'
  ) then
    create policy recipes_update_own on public.recipes
      for update to authenticated
      using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'recipes'
      and policyname = 'recipes_delete_own'
  ) then
    create policy recipes_delete_own on public.recipes
      for delete to authenticated using ((select auth.uid()) = user_id);
  end if;
end
$$;

revoke all on table public.recipes from anon;
grant select, insert, update, delete on table public.recipes to authenticated;

create or replace function public.samos_recipes_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists samos_recipes_updated_at on public.recipes;
create trigger samos_recipes_updated_at
before update on public.recipes
for each row execute function public.samos_recipes_touch_updated_at();
