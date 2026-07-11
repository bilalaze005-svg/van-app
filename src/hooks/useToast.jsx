import { useState, useCallback } from 'react'

export default function useToast() {
  const [toast, setToast] = useState(null)

  const showToast = useCallback((msg, isError = false) => {
    setToast({ msg, isError })
    setTimeout(() => setToast(null), 3000)
  }, [])

  const ToastUI = toast ? (
    <div style={{
      position: 'fixed', bottom: 90, right: 16, left: 16, maxWidth: 460, margin: '0 auto',
      background: toast.isError ? '#DC2626' : '#0D1B2A', color: 'white', borderRadius: 14,
      padding: '12px 18px', fontSize: 13, fontWeight: 700, textAlign: 'center', zIndex: 9999,
      boxShadow: '0 6px 20px rgba(0,0,0,.25)',
    }}>
      {toast.msg}
    </div>
  ) : null

  return [showToast, ToastUI]
}
