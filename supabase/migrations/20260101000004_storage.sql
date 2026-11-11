-- =====================================================================
-- QURANDAZI — 0004 Storage buckets & policies
--   avatars : users upload into  avatars/<their-user-id>/...
--   media   : admins upload category images & campaign banners
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('media',   'media',   true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Public read
create policy "storage: public read avatars & media" on storage.objects
  for select to anon, authenticated using (bucket_id in ('avatars', 'media'));

-- Avatars: owner-only writes inside their own folder
create policy "storage: users upload own avatar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "storage: users update own avatar" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "storage: users delete own avatar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Media: administrators only
create policy "storage: admins upload media" on storage.objects
  for insert to authenticated with check (bucket_id = 'media' and public.is_admin());
create policy "storage: admins update media" on storage.objects
  for update to authenticated using (bucket_id = 'media' and public.is_admin());
create policy "storage: admins delete media" on storage.objects
  for delete to authenticated using (bucket_id = 'media' and public.is_admin());
