-- Storage bucket for person photos
insert into storage.buckets (id, name, public)
values ('person-photos', 'person-photos', true)
on conflict (id) do nothing;

-- Allow public read access for avatars
create policy "photos_public_read"
on storage.objects for select
using (bucket_id = 'person-photos');

-- Allow authenticated uploads
create policy "photos_authenticated_insert"
on storage.objects for insert
with check (bucket_id = 'person-photos' and auth.role() = 'authenticated');

create policy "photos_authenticated_update"
on storage.objects for update
using (bucket_id = 'person-photos' and auth.role() = 'authenticated');

create policy "photos_authenticated_delete"
on storage.objects for delete
using (bucket_id = 'person-photos' and auth.role() = 'authenticated');
