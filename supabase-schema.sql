-- Ejecutar todo este archivo en Supabase > SQL Editor > New query.
create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text default '',
  category text default '',
  description text default '',
  price numeric(12,0) not null default 0 check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone text not null,
  address text default '',
  notes text default '',
  items jsonb not null default '[]'::jsonb,
  total numeric(12,0) not null default 0,
  status text not null default 'Nuevo',
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;
alter table public.orders enable row level security;

-- Catálogo visible para visitantes; solo usuarios autenticados administran.
drop policy if exists "Public can view active products" on public.products;
create policy "Public can view active products" on public.products for select using (active = true or auth.role() = 'authenticated');
drop policy if exists "Authenticated admins insert products" on public.products;
create policy "Authenticated admins insert products" on public.products for insert to authenticated with check (true);
drop policy if exists "Authenticated admins update products" on public.products;
create policy "Authenticated admins update products" on public.products for update to authenticated using (true) with check (true);
drop policy if exists "Authenticated admins delete products" on public.products;
create policy "Authenticated admins delete products" on public.products for delete to authenticated using (true);

-- Visitantes pueden registrar pedidos; solo el administrador autenticado los consulta y modifica.
drop policy if exists "Visitors can create orders" on public.orders;
create policy "Visitors can create orders" on public.orders for insert to anon, authenticated with check (true);
drop policy if exists "Admins can read orders" on public.orders;
create policy "Admins can read orders" on public.orders for select to authenticated using (true);
drop policy if exists "Admins can update orders" on public.orders;
create policy "Admins can update orders" on public.orders for update to authenticated using (true) with check (true);

-- Bucket público para mostrar fotos de perfumes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "Public can view product images" on storage.objects;
create policy "Public can view product images" on storage.objects for select using (bucket_id = 'product-images');
drop policy if exists "Admins can upload product images" on storage.objects;
create policy "Admins can upload product images" on storage.objects for insert to authenticated with check (bucket_id = 'product-images');
drop policy if exists "Admins can update product images" on storage.objects;
create policy "Admins can update product images" on storage.objects for update to authenticated using (bucket_id = 'product-images') with check (bucket_id = 'product-images');
drop policy if exists "Admins can delete product images" on storage.objects;
create policy "Admins can delete product images" on storage.objects for delete to authenticated using (bucket_id = 'product-images');