-- Gỡ bài seed «Ấm áp» khỏi kho nhạc thiệp. Thiệp đang phát bài này hết nhạc nền.
with removed as (
  delete from public.wedding_music_library
  where audio_url = '/wedding-music/heartwarming.mp3'
     or (source = 'seed' and title = 'Ấm áp')
  returning 1
),
cleared as (
  update public.wedding_cards
  set music_url = '',
      music_play_start_sec = null,
      music_play_end_sec = null
  where music_url = '/wedding-music/heartwarming.mp3'
  returning 1
)
select (select count(*) from removed) as removed_tracks,
       (select count(*) from cleared) as cleared_cards;
