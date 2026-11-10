-- SHAKH STORE / M04: secure product image storage.
-- Additive migration; product images are uploaded through authenticated server APIs.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp','image/avif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists product_images_public_read on storage.objects;
create policy product_images_public_read
on storage.objects for select
to anon, authenticated
using (bucket_id = 'product-images');

commit;
