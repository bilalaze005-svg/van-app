// ============================================================
// src/lib/queryClient.js
// عميل React Query مشترك للتطبيق. الإعدادات هنا مناسبة لتطبيق ميداني
// يعمل أحياناً بلا اتصال: لا إعادة محاولة تلقائية مفرطة، وتحديث معقول
// عند العودة للتطبيق بدل كل ثانية.
// ============================================================
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 15_000, // 15 ثانية — يكفي لتفادي إعادة الجلب عند كل إعادة عرض بسيطة
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 0, // العمليات (بيع، تحميل...) لها منطق أوفلاين خاص بها، لا نريد React Query يعيد المحاولة تلقائياً فوقه
    },
  },
})
