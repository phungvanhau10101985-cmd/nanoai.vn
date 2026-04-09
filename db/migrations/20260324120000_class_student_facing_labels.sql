-- HS thấy rõ lớp / môn / GV khi tham gia; GV lưu mặc định dùng lại

alter table classes
  add column if not exists subject_label text,
  add column if not exists teacher_display_name text;

comment on column classes.subject_label is 'Môn hoặc nhãn ngắn hiển thị cho HS (VD: Toán)';
comment on column classes.teacher_display_name is 'Tên GV hiển thị cho HS (VD: Cô Duyên)';

alter table teacher_school_settings
  add column if not exists teacher_display_name text,
  add column if not exists default_subject_label text;

comment on column teacher_school_settings.teacher_display_name is 'Tên GV mặc định khi tạo lớp/đề';
comment on column teacher_school_settings.default_subject_label is 'Môn mặc định gợi ý khi tạo lớp';
