"use client"

import * as React from "react"
import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

function safeReactNode(node: unknown): React.ReactNode {
  if (node == null) return null
  if (React.isValidElement(node)) return node
  if (typeof node === 'string' || typeof node === 'number') return node
  return null
}

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title != null && <ToastTitle>{safeReactNode(title)}</ToastTitle>}
              {description != null && (
                <ToastDescription>{safeReactNode(description)}</ToastDescription>
              )}
            </div>
            {action != null ? safeReactNode(action) : null}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
