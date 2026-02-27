export type LiveTopicOption = {
  id: string
  label: string
}

export const LIVE_TOPIC_OPTIONS: LiveTopicOption[] = [
  { id: 'solo-teacher', label: 'Solo: Hoi thoai truc tiep voi thay/co' },
  { id: 'daily-small-talk', label: 'Giao tiep hang ngay (small talk)' },
  { id: 'food-ordering', label: 'Goi mon tai nha hang/quan an' },
  { id: 'shopping', label: 'Mua sam va hoi gia' },
  { id: 'airport', label: 'San bay va check-in' },
  { id: 'hotel-checkin', label: 'Khach san va check-in/check-out' },
  { id: 'job-interview', label: 'Phong van xin viec' },
  { id: 'office-meeting', label: 'Hop va giao tiep cong viec' },
  { id: 'doctor-visit', label: 'Kham benh va hoi trieu chung' },
  { id: 'travel-directions', label: 'Du lich va hoi duong' },
  { id: 'presentation', label: 'Thuyet trinh va hoi dap' },
]

export const LIVE_GOAL_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'communication', label: 'Giao tiep' },
  { id: 'job', label: 'Cong viec' },
  { id: 'travel', label: 'Du lich' },
  { id: 'exam', label: 'Thi cu' },
]
