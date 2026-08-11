-- Reviews y calificación por estrellas para desarrolladoras.
--
-- Las desarrolladoras viven como datos estáticos en js/developers-data.js
-- (no hay una tabla `developers` en Supabase todavía), así que developer_id
-- guarda el slug tal cual (texto), sin foreign key. user_id sí referencia
-- auth.users porque las reviews requieren una persona autenticada de
-- verdad.
--
-- user_name es una copia del email al momento de dejar la review: el
-- cliente no puede leer auth.users de otras personas (Supabase no lo
-- expone vía la API por privacidad), así que sin este campo no habría
-- forma de mostrar "nombre de usuario" en las reviews de otras personas
-- sin agregar una tabla `profiles` aparte. Esto evita esa tabla extra
-- mientras el único dato de identidad disponible sea el email.
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  developer_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_name text not null,
  rating smallint not null check (rating between 1 and 5),
  comentario text,
  fecha timestamptz not null default now(),
  -- Un usuario, una review por desarrolladora: upsert con
  -- onConflict "developer_id,user_id" desde el cliente actualiza en vez de
  -- duplicar (ver js/reviews-supabase.js).
  unique (developer_id, user_id)
);

create index if not exists reviews_developer_id_idx on public.reviews (developer_id);

alter table public.reviews enable row level security;

-- El promedio y la lista de reviews son públicos.
create policy "reviews_select_all" on public.reviews
  for select using (true);

create policy "reviews_insert_own" on public.reviews
  for insert with check (auth.uid() = user_id);

create policy "reviews_update_own" on public.reviews
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "reviews_delete_own" on public.reviews
  for delete using (auth.uid() = user_id);
