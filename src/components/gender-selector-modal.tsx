"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { UserRound, UserRoundCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Gender = 'male' | 'female'

export default function GenderSelectorModal() {
  const [open, setOpen] = useState(false)
  const [selectedGender, setSelectedGender] = useState<Gender>('male')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    checkUserGender()
  }, [])

  const checkUserGender = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const userGender = user.user_metadata?.gender
      
      // Nếu user chưa có giới tính, hiển thị popup
      if (!userGender) {
        // Đợi 1 giây để trang load xong rồi hiện popup
        setTimeout(() => {
          setOpen(true)
        }, 1000)
      }
    } catch (error) {
      console.error('Error checking user gender:', error)
    }
  }

  const handleGenderSelect = async () => {
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          gender: selectedGender,
        },
      })

      if (error) {
        console.error('Error updating gender:', error)
        return
      }

      setOpen(false)
      
      // Hiển thị thông báo thành công
      alert(`Đã lưu giới tính: ${selectedGender === 'male' ? 'Nam' : 'Nữ'}. Bạn có thể thay đổi trong cài đặt tài khoản.`)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSkip = () => {
    setOpen(false)
    alert('Bạn có thể chọn giới tính sau trong cài đặt tài khoản.')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Chọn giới tính của bạn</DialogTitle>
          <DialogDescription>
            Giới tính giúp hệ thống tối ưu giao diện và gợi ý sản phẩm phù hợp với bạn.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <label className="group cursor-pointer">
              <input
                type="radio"
                name="gender"
                value="male"
                checked={selectedGender === 'male'}
                onChange={() => setSelectedGender('male')}
                className="sr-only"
              />
              <div className={`
                rounded-lg border-2 p-4 transition-all duration-200
                ${selectedGender === 'male' 
                  ? 'border-blue-500 bg-blue-50 shadow-sm' 
                  : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/40'
                }
              `}>
                <div className="flex flex-col items-center gap-2">
                  <div className="rounded-full bg-blue-100 p-3">
                    <UserRound className="h-6 w-6 text-blue-600" />
                  </div>
                  <span className="font-medium text-gray-800">Nam</span>
                  <span className="text-xs text-gray-500 text-center">
                    Tối ưu cho nam giới
                  </span>
                </div>
              </div>
            </label>

            <label className="group cursor-pointer">
              <input
                type="radio"
                name="gender"
                value="female"
                checked={selectedGender === 'female'}
                onChange={() => setSelectedGender('female')}
                className="sr-only"
              />
              <div className={`
                rounded-lg border-2 p-4 transition-all duration-200
                ${selectedGender === 'female' 
                  ? 'border-pink-500 bg-pink-50 shadow-sm' 
                  : 'border-gray-200 bg-white hover:border-pink-300 hover:bg-pink-50/40'
                }
              `}>
                <div className="flex flex-col items-center gap-2">
                  <div className="rounded-full bg-pink-100 p-3">
                    <UserRoundCheck className="h-6 w-6 text-pink-600" />
                  </div>
                  <span className="font-medium text-gray-800">Nữ</span>
                  <span className="text-xs text-gray-500 text-center">
                    Tối ưu cho nữ giới
                  </span>
                </div>
              </div>
            </label>
          </div>

          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Lưu ý:</span> Giới tính chỉ dùng để tùy biến giao diện và gợi ý sản phẩm phù hợp. Bạn có thể thay đổi sau trong cài đặt tài khoản.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button 
            onClick={handleSkip}
            variant="outline" 
            className="flex-1"
          >
            Để sau
          </Button>
          <Button 
            onClick={handleGenderSelect}
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            {loading ? 'Đang lưu...' : 'Xác nhận'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}