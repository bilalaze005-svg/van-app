// ============================================================
// src/lib/settlementCalc.js
// دوال حساب صرفة (بدون أي استدعاء شبكة) لملخص التسوية — مفصولة
// هنا تحديدًا لتكون قابلة للاختبار بمعزل عن الـhook/الواجهة.
// ============================================================

export const PERIODS = {
  day: { label: 'اليوم', getStart: () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d } },
  week: { label: 'هذا الأسبوع', getStart: () => { const d = new Date(); const day = d.getDay(); d.setDate(d.getDate() - day); d.setHours(0, 0, 0, 0); return d } },
  month: { label: 'هذا الشهر', getStart: () => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d } },
}

export const MODE_LABEL = { cash: '💵 نقداً', credit: '📝 آجل', cheque: '🧾 شيك', transfer: '🏦 تحويل' }

/** إجمالي قيمة كل عمليات البيع */
export function totalSales(sales) {
  return sales.reduce((s, o) => s + Number(o.total), 0)
}

/** تجميع المبيعات حسب طريقة الدفع: { cash: 1200, credit: 300, ... } */
export function salesByMode(sales) {
  return sales.reduce((acc, o) => {
    const m = o.pay_mode || 'cash'
    acc[m] = (acc[m] || 0) + Number(o.total)
    return acc
  }, {})
}

/** القيمة التقديرية الإجمالية لمخزون الكاميو الحالي */
export function vanStockValue(vanStock) {
  return vanStock.reduce((s, v) => s + Number(v.qty) * Number(v.price), 0)
}
