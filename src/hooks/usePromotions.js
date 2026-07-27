import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.js'

/**
 * @file usePromotions.js
 * @description جلب العروض النشطة حالياً من جدول promotions، لعرضها للموظف
 * (منفصل عن الاستعلام الموجود داخل useVanSale.js الذي يُستخدم لحساب أسعار
 * البيع؛ react-query يشارك نفس queryKey فلا يوجد ازدواج فعلي بالطلبات).
 */
async function fetchActivePromotions() {
  const { data, error } = await supabase.from('promotions').select('*').eq('active', true)
  if (error) throw error
  return data || []
}

export default function usePromotions() {
  return useQuery({
    queryKey: ['promotions', 'active'],
    queryFn: fetchActivePromotions,
    staleTime: 2 * 60 * 1000,
  })
}
