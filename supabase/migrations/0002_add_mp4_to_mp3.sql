insert into public.tools(id, name, category, enabled)
values ('mp4-to-mp3', 'MP4 to MP3', 'audio', true)
on conflict (id) do update
set name = excluded.name, category = excluded.category, enabled = true;
