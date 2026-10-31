-- Gỡ ba bài seed không lời và hai file nhạc tải lên khỏi kho thiệp.
delete from public.wedding_music_library
where audio_url in (
  '/wedding-music/a-little-faith.mp3',
  '/wedding-music/water-lily.mp3',
  '/wedding-music/frost-waltz.mp3',
  'https://cdn.nanoai.vn/uploads/7e674071-e288-4c4c-ba3c-d7b39a2bcb17/wedding_4e09e349-2208-4e8d-a422-3303e57e35f6_music_1785482170732.mp3',
  'https://cdn.nanoai.vn/uploads/7e674071-e288-4c4c-ba3c-d7b39a2bcb17/wedding_4e09e349-2208-4e8d-a422-3303e57e35f6_music_1791337889826.mp3'
);

update public.wedding_cards
set music_url = ''
where music_url in (
  '/wedding-music/a-little-faith.mp3',
  '/wedding-music/water-lily.mp3',
  '/wedding-music/frost-waltz.mp3',
  'https://cdn.nanoai.vn/uploads/7e674071-e288-4c4c-ba3c-d7b39a2bcb17/wedding_4e09e349-2208-4e8d-a422-3303e57e35f6_music_1785482170732.mp3',
  'https://cdn.nanoai.vn/uploads/7e674071-e288-4c4c-ba3c-d7b39a2bcb17/wedding_4e09e349-2208-4e8d-a422-3303e57e35f6_music_1791337889826.mp3'
);
