/**
 * @file offlineQueue.js
 * @description طابور مبيعات معلّقة تُخزَّن في localStorage عندما ينقطع
 * الاتصال أثناء محاولة إتمام بيع. تُزامَن تلقائياً عند عودة الشبكة.
 *
 * لماذا نحتاج هذا؟ الموظف المتنقّل (بائع الكاميو) غالباً ما يعمل في
 * مناطق بتغطية شبكة ضعيفة أو متقطعة. بدل أن يفشل البيع بالكامل ويُجبر
 * الموظف على تذكّر إعادة إدخاله لاحقاً، نحفظه محلياً ونرسله بمجرد
 * عودة الاتصال.
 */

const KEY = 'nq_van_pending_sales'

export function getPendingSales() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

export function queueSale(sale) {
  const pending = getPendingSales()
  const withId = { ...sale, _localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, _queuedAt: new Date().toISOString() }
  pending.push(withId)
  localStorage.setItem(KEY, JSON.stringify(pending))
  return withId
}

export function removePendingSale(localId) {
  const pending = getPendingSales().filter(s => s._localId !== localId)
  localStorage.setItem(KEY, JSON.stringify(pending))
}

export function pendingCount() {
  return getPendingSales().length
}

/**
 * يحاول إرسال كل المبيعات المعلّقة عبر supabase.rpc('complete_van_sale', ...).
 * يرجع { synced, failed } — أي مبيعة فشلت لخطأ منطقي (وليس شبكة) تبقى
 * بالطابور مع سبب الفشل حتى يراجعها الموظف يدوياً بدل ضياعها بصمت.
 */
export async function syncPendingSales(supabase) {
  const pending = getPendingSales()
  let synced = 0
  const stillPending = []

  for (const sale of pending) {
    try {
      const { error } = await supabase.rpc('complete_van_sale', {
        p_employee_id: sale.employee_id,
        p_items: sale.items,
        p_customer_name: sale.customer_name,
        p_customer_phone: sale.customer_phone,
        p_pay_mode: sale.pay_mode,
        p_discount: sale.discount || 0,
      })
      if (error) throw error
      synced++
    } catch (e) {
      const isNetworkError = e?.message === 'Failed to fetch' || e?.name === 'TypeError'
      if (isNetworkError) {
        // ما زلنا غير متصلين فعلياً، أبقِ العملية بالطابور دون تغيير
        stillPending.push(sale)
      } else {
        // خطأ منطقي حقيقي (نقص مخزون مثلاً) — أبقِها مع سبب الفشل
        // ليراجعها الموظف بدل حذفها بصمت
        stillPending.push({ ...sale, _error: e.message || 'فشل غير معروف' })
      }
    }
  }

  localStorage.setItem(KEY, JSON.stringify(stillPending))
  return { synced, failed: stillPending.length }
}
