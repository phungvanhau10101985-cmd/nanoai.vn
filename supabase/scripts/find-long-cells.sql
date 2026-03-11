-- Tìm các ô có dữ liệu dài > 32767 ký tự (giới hạn Excel)
-- Chạy trong Supabase SQL Editor

-- 1. question_text dài
SELECT id, 'question_text' as col, length(question_text) as len,
  left(question_text, 80) || '...' as preview
FROM worksheet_official_questions
WHERE length(question_text) > 32767

UNION ALL

-- 2. explanation dài
SELECT id, 'explanation' as col, length(explanation) as len,
  left(explanation, 80) || '...' as preview
FROM worksheet_official_questions
WHERE explanation IS NOT NULL AND length(explanation) > 32767

UNION ALL

-- 3. options (khi flatten: "A. x | B. y | C. z | D. w") - tính độ dài khi join
SELECT id, 'options' as col,
  length(
    (SELECT string_agg(chr(64 + ord.i::int) || '. ' || opt, ' | ')
     FROM jsonb_array_elements_text(options) WITH ORDINALITY AS t(opt, ord))
  ) as len,
  left(options::text, 80) || '...' as preview
FROM worksheet_official_questions
WHERE length(
  (SELECT string_agg(chr(64 + ord.i::int) || '. ' || opt, ' | ')
   FROM jsonb_array_elements_text(options) WITH ORDINALITY AS t(opt, ord))
) > 32767

ORDER BY len DESC;

-- Nếu không có kết quả: kiểm tra top 10 ô dài nhất (gần ngưỡng)
SELECT id, 
  length(question_text) as q_len,
  length(explanation) as exp_len,
  length(options::text) as opt_len
FROM worksheet_official_questions
ORDER BY greatest(
  coalesce(length(question_text), 0),
  coalesce(length(explanation), 0),
  length(options::text)
) DESC
LIMIT 20;
