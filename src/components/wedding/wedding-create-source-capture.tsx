'use client'

import { useEffect } from 'react'
import { subscribeToUrlChanges } from '@/lib/client-history-navigation'
import { rememberWeddingCreateSource } from '@/lib/wedding/wedding-create-source'

/** Giữ utm và trang giới thiệu khi khách chuyển trang, để lúc bấm tạo thiệp còn biết kênh. */
export function WeddingCreateSourceCapture() {
  useEffect(() => {
    rememberWeddingCreateSource()
    return subscribeToUrlChanges(() => {
      rememberWeddingCreateSource()
    })
  }, [])
  return null
}
