// ============================================================
// src/hooks/useVanSale.js
//
// كل منطق البيانات والعمليات لتبويب البيع (SellTab): تحميل مخزون
// الكاميو، تحميل العروض، إدارة السلة، وإتمام البيع (مع دعم وضع
// عدم الاتصال). الواجهة (SellTab.jsx) تستهلك هذا الـhook فقط.
// ============================================================
import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.js'
import { queueSale } from '../lib/offlineQueue.js'
import { applyPromotions } from '../lib/promotions.js'

/**
 * @typedef {Object} VanStockItem
 * @property {string} product_id
 * @property {string} name
 * @property {number} price
 * @property {number} qty        - الكمية المتوفرة حالياً بالكاميو
 * @property {string=} image
 * @property {number|null} brand_id
 */

/**
 * @typedef {Object} CartItem
 * @property {string} product_id
 * @property {string} name
 * @property {number} price
 * @property {string=} image
 * @property {number} qty        - الكمية المطلوبة بالسلة
 * @property {number} maxQty     - أقصى كمية متاحة (من مخزون الكاميو)
 * @property {number|null} brand_id
 */

/**
 * @param {string} employeeId
 * @returns {Promise<VanStockItem[]>}
 */
async function fetchVanStock(employeeId) {
  const { data, error } = await supabase.rpc('get_van_stock', { p_employee_id: employeeId })
  if (error) throw error
  const stock = data || []

  // ✅ get_van_stock لا ترجع brand_id (لازم لعروض "خصم حسب الرتبة")،
  // نجيبها باستعلام خفيف منفصل بدل تعديل دالة RPC نفسها
  const ids = stock.map((s) => s.product_id).filter(Boolean)
  let brandMap = {}
  if (ids.length) {
    const { data: prodBrands } = await supabase.from('products').select('id,brand_id').in('id', ids)
    brandMap = Object.fromEntries((prodBrands || []).map((p) => [p.id, p.brand_id]))
  }
  return stock.map((s) => ({ ...s, brand_id: brandMap[s.product_id] ?? null }))
}

async function fetchPromos() {
  const { data, error } = await supabase.from('promotions').select('*').eq('active', true)
  if (error) throw error
  return data || []
}

/**
 * @param {Object} args
 * @param {{id: string, name: string}} args.employee
 * @param {(msg: string, isError?: boolean) => void} args.showToast
 * @param {boolean} args.isOnline
 */
export default function useVanSale({ employee, showToast, isOnline }) {
  const queryClient = useQueryClient()

  // ✅ React Query يتكفّل بالتخزين المؤقت وإعادة الجلب التلقائي (عند التركيز
  // على النافذة مثلاً)، ويمنع طلبات مكرَّرة لو استُخدم نفس الـhook في أكثر
  // من مكان بنفس الوقت
  const vanStockQuery = useQuery({
    queryKey: ['van-stock', employee.id],
    queryFn: () => fetchVanStock(employee.id),
    enabled: !!employee.id,
  })
  const promosQuery = useQuery({
    queryKey: ['promotions', 'active'],
    queryFn: fetchPromos,
    staleTime: 5 * 60_000, // العروض تتغيّر نادراً — تخزين مؤقت أطول
  })

  const vanStock = vanStockQuery.data || []
  const promos = promosQuery.data || []

  // ✅ يسمح بخصم تفاؤلي محلي فوري بعد بيع (بدون انتظار إعادة جلب من الخادم)
  const patchVanStockCache = (updater) => {
    queryClient.setQueryData(['van-stock', employee.id], (old) => updater(old || []))
  }

  const [cart, setCart] = useState([])
  const [saving, setSaving] = useState(false)
  const [lastReceipt, setLastReceipt] = useState(null)

  /** @param {VanStockItem} item */
  const addToCart = (item) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.product_id === item.product_id)
      if (existing) {
        if (existing.qty >= item.qty) { showToast('⚠️ الكمية المتوفرة بالكاميو محدودة', true); return prev }
        return prev.map((c) => c.product_id === item.product_id ? { ...c, qty: c.qty + 1 } : c)
      }
      return [...prev, { product_id: item.product_id, name: item.name, price: item.price, image: item.image, qty: 1, maxQty: item.qty, brand_id: item.brand_id }]
    })
  }

  const cartQtyFor = (id) => cart.find((c) => c.product_id === id)?.qty || 0

  const updateQty = (id, delta) => {
    setCart((prev) => prev.map((c) => {
      if (c.product_id !== id) return c
      const newQty = c.qty + delta
      if (newQty <= 0) return c
      if (newQty > c.maxQty) { showToast('⚠️ الكمية المتوفرة بالكاميو محدودة', true); return c }
      return { ...c, qty: newQty }
    }).filter((c) => c.qty > 0))
  }

  const removeFromCart = (id) => setCart((prev) => prev.filter((c) => c.product_id !== id))

  // ✅ حساب العروض المطبَّقة على السلة الحالية (bogo/percent/fixed/tier_discount)
  const promoInput = cart.map((c) => ({ id: c.product_id, price: c.price, qty: c.qty, brand_id: c.brand_id }))
  const { promoDiscount, appliedPromoNames, netTotal } = applyPromotions(promoInput, promos)
  const total = netTotal

  // ينجز عملية البيع. يرجع {queued: boolean} عند النجاح، أو يرمي استثناء
  // عند فشل حقيقي (غير متعلق بالشبكة) — الواجهة تقرر شكل رسالة التوست.
  /**
   * ينجز عملية البيع. يرجع {queued: boolean} عند النجاح، أو يرمي استثناء
   * عند فشل حقيقي (غير متعلق بالشبكة) — الواجهة تقرر شكل رسالة التوست.
   * @param {{shopName: string, shopPhone: string, payMode: 'cash'|'credit'|'cheque'}} args
   * @returns {Promise<{queued: boolean, receiptData: object, wasNetworkFallback?: boolean}|null>}
   */
  const completeSale = async ({ shopName, shopPhone, payMode }) => {
    if (saving) return null
    if (cart.length === 0) { showToast('⚠️ السلة فارغة', true); return null }
    if (!shopName.trim()) { showToast('⚠️ أدخل اسم المحل', true); return null }

    setSaving(true)
    const items = cart.map((c) => ({ product_id: c.product_id, name: c.name, price: c.price, qty: c.qty }))
    const salePayload = {
      employee_id: employee.id,
      items,
      customer_name: shopName.trim(),
      customer_phone: shopPhone.trim() || null,
      pay_mode: payMode,
      discount: promoDiscount || 0,
    }
    const receiptData = {
      shopName: shopName.trim(),
      shopPhone: shopPhone.trim(),
      employeeName: employee.name,
      date: new Date().toLocaleString('ar-DZ'),
      items,
      total,
      promoDiscount,
      appliedPromoNames,
      payMode,
    }

    const finishAsQueued = () => {
      queueSale(salePayload)
      // خصم تفاؤلي من المخزون المعروض محلياً حتى لا يُباع نفس الصنف
      // مرتين قبل مزامنة هذه العملية مع الخادم
      patchVanStockCache((prev) => prev.map((v) => {
        const sold = items.find((i) => i.product_id === v.product_id)
        return sold ? { ...v, qty: v.qty - sold.qty } : v
      }))
      setCart([])
      setLastReceipt(receiptData)
    }

    // بدون اتصال أصلاً؟ لا داعي لمحاولة الشبكة، نحفظ بالطابور مباشرة
    if (!isOnline) {
      finishAsQueued()
      setSaving(false)
      return { queued: true, receiptData }
    }

    try {
      // ✅ نداء واحد ذرّي: يخصم كل الأصناف ويسجّل الطلب داخل معاملة واحدة.
      // لو فشل أي صنف (نقص كمية مثلاً)، تتراجع كل العملية تلقائياً.
      // انظر supabase/complete_van_sale.sql
      const { error } = await supabase.rpc('complete_van_sale', {
        p_employee_id: employee.id,
        p_items: items,
        p_customer_name: shopName.trim(),
        p_customer_phone: shopPhone.trim() || null,
        p_pay_mode: payMode,
        p_discount: promoDiscount || 0,
      })
      if (error) throw error

      setCart([])
      setLastReceipt(receiptData)
      // ✅ إضافة بسيطة أتاحتها React Query: تحديث المخزون من الخادم مباشرة
      // بعد نجاح البيع فعلياً (بدل انتظار إعادة تحميل الصفحة لاحقاً)
      vanStockQuery.refetch()
      return { queued: false, receiptData }
    } catch (e) {
      const isNetworkError = e?.message === 'Failed to fetch' || e?.name === 'TypeError'
      if (isNetworkError) {
        finishAsQueued()
        return { queued: true, receiptData, wasNetworkFallback: true }
      }
      // ملاحظة: بما أن complete_van_sale ذرّية، فشلها المنطقي يعني عدم
      // حدوث أي تغيير فعلي بالخادم، فلا حاجة لإعادة تحميل المخزون
      throw e
    } finally {
      setSaving(false)
    }
  }

  return {
    vanStock, cart, saving, lastReceipt, setLastReceipt,
    promoDiscount, appliedPromoNames, total,
    addToCart, cartQtyFor, updateQty, removeFromCart, completeSale,
  }
}
