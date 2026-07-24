// ============================================================
// src/lib/vanStock.js
//
// ✅ دالة جلب واحدة مشتركة لمخزون الكاميو، تُستخدم من useVanSale.js
// و useLoadStock.js معاً (يشتركان بنفس queryKey ['van-stock', employeeId]
// في React Query). كانا سابقاً يملكان نسختين مختلفتين من هذه الدالة:
// واحدة تُغني البيانات بـ carton_price/units (لتحديد "يُباع بالكرتون")
// والأخرى لا تفعل. بما أن الكاش مشترك بنفس المفتاح، أي refetch من أي
// الطرفين يكتب فوق كاش الطرف الآخر — فكان تحميل منتج من تبويب "تحميل"
// يمسح حقول الكرتون من الكاش ويُظهر كل شيء "بالقطعة" حتى يُعاد الجلب من
// تبويب "بيع". توحيد الدالة هنا يضمن أن أي refetch، من أي مكان، يرجع
// دائماً بنفس الشكل الكامل (مع carton_price/units/brand_id).
// ============================================================
import { supabase } from './supabase.js'

export async function fetchVanStock(employeeId) {
  const { data, error } = await supabase.rpc('get_van_stock', { p_employee_id: employeeId })
  if (error) throw error
  const stock = data || []

  // ✅ get_van_stock لا ترجع brand_id/carton_price/units (لازمة لعروض
  // "خصم حسب الرتبة" وللبيع بالكرتون)، نجيبها باستعلام خفيف منفصل بدل
  // تعديل دالة RPC نفسها
  const ids = stock.map((s) => s.product_id).filter(Boolean)
  let prodMap = {}
  if (ids.length) {
    const { data: prodExtra } = await supabase.from('products').select('id,brand_id,carton_price,units').in('id', ids)
    prodMap = Object.fromEntries((prodExtra || []).map((p) => [p.id, p]))
  }
  return stock.map((s) => ({
    ...s,
    brand_id: prodMap[s.product_id]?.brand_id ?? null,
    carton_price: prodMap[s.product_id]?.carton_price ?? null,
    units: prodMap[s.product_id]?.units ?? null,
  }))
}
