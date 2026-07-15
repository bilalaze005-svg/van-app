import { useState, useEffect } from 'react'

/**
 * يراقب حالة الاتصال بالإنترنت عبر أحداث المتصفح online/offline.
 * ملاحظة: navigator.onLine قد يكون "true" حتى لو الاتصال ضعيف جداً
 * (يعني فقط أن الجهاز متصل بشبكة، وليس بالضرورة أن الإنترنت يعمل)،
 * لكنه كافٍ لتنبيه الموظف بأنه فقد الاتصال تمامًا أثناء الجولة.
 */
export default function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )

  useEffect(() => {
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return isOnline
}
