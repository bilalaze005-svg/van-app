/**
 * @file session.js
 * @description تحقق دوري: هل ما زال الموظف مصرَّحًا له باستخدام تطبيق
 * الكاميو؟ يُستدعى كل بضع دقائق ومتى يُفتح التطبيق من جديد، لتفادي بقاء
 * موظف تم إلغاء صلاحيته من لوحة الإدارة قادرًا على الاستخدام حتى يسجّل
 * خروجه يدويًا.
 *
 * مهم: لو فشل الاستدعاء بسبب انعدام الاتصال (وليس رفضًا صريحًا)، لا نسجّل
 * خروج الموظف — لأنه غالبًا يعمل بدون شبكة أثناء جولته، ومعاقبته على ذلك
 * تكسر تجربة الأوفلاين التي بنيناها.
 */
import { supabase } from './supabase.js'

export async function checkEmployeeAccess(employeeId) {
  try {
    const { data, error } = await supabase.rpc('check_employee_access', {
      p_employee_id: employeeId,
    })
    if (error) throw error

    const perms = typeof data === 'string' ? JSON.parse(data) : (data || {})
    const hasAccess = (perms.vanApp || []).includes('view')
    return { checked: true, hasAccess }
  } catch (e) {
    const isNetworkError = e?.message === 'Failed to fetch' || e?.name === 'TypeError'
    // خطأ شبكة: لا نستطيع الجزم، لا نسجّل الخروج
    return { checked: false, hasAccess: true, networkError: isNetworkError }
  }
}
