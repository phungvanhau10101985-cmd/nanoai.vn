-- Một lớp (trường + tên) có nhiều môn. Học sinh vẫn nằm trên classes / class_members.

create table if not exists public.class_subjects (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  subject_id varchar(40) not null,
  subject_label text not null,
  teacher_display_name text,
  created_at timestamptz not null default now(),
  unique (class_id, teacher_id, subject_id)
);

create index if not exists idx_class_subjects_teacher on public.class_subjects(teacher_id);
create index if not exists idx_class_subjects_class on public.class_subjects(class_id);

comment on table public.class_subjects is 'Giáo viên dạy một môn trong lớp. Không phải học sinh, không đổi chủ lớp.';

-- Gắn môn sẵn có của chủ lớp. Nhãn trống thì bỏ qua.
insert into public.class_subjects (class_id, teacher_id, subject_id, subject_label, teacher_display_name)
select
  c.id,
  c.teacher_id,
  case
    when n ~ '(^| )toan($| )' or n like '%toan hoc%' then 'toan'
    when n like '%ngu van%' or n like '%van hoc%' or n = 'van' then 'ngu-van'
    when n like '%tieng anh%' or n like '%anh van%' then 'tieng-anh'
    when n like '%vat ly%' or n like '%vatli%' or n = 'ly' then 'vat-ly'
    when n like '%hoa hoc%' or n = 'hoa' then 'hoa-hoc'
    when n like '%sinh hoc%' or n = 'sinh' then 'sinh-hoc'
    when n like '%lich su%' then 'lich-su'
    when n like '%dia ly%' or n like '%dialy%' then 'dia-ly'
    when n like '%giao duc cong dan%' or n = 'gdcd' then 'gdcd'
    when n like '%tin hoc%' then 'tin-hoc'
    when n like '%cong nghe%' then 'cong-nghe'
    when n like '%am nhac%' then 'am-nhac'
    when n like '%my thuat%' then 'my-thuat'
    when n like '%the duc%' then 'the-duc'
    else 'khac'
  end,
  btrim(c.subject_label),
  nullif(btrim(coalesce(c.teacher_display_name, '')), '')
from public.classes c
cross join lateral (
  select translate(
    lower(btrim(c.subject_label)),
    'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ',
    'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd'
  ) as n
) norm
where nullif(btrim(coalesce(c.subject_label, '')), '') is not null
on conflict (class_id, teacher_id, subject_id) do nothing;
