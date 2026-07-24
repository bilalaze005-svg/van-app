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
import { fetchVanStock } from '../lib/vanStock.js'
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

  // ✅ السعر الفعلي حسب وحدة البيع (كرتون لو مفروض ومتوفر، وإلا بالقطعة)
  const unitPrice = (item) => (item.unitMode === 'carton' && item.cartonPrice ? item.cartonPrice : item.price)

  /** @param {VanStockItem} item */
  const addToCart = (item) => {
    // ✅ بيع بالكرتون فقط. مخزون الكاميو (get_van_stock) مُخزَّن بالكرتون
    // دائماً (نفس اصطلاح كامل النظام: المخزون الرئيسي وسجل المشتريات كلها
    // بالكرتون) — لذلك وضع الكرتون لا يحتاج أي تحويل: عدد الكراتين
    // بالسلة يُقارَن مباشرة بـ item.qty (كراتين متوفرة بالكاميو).
    // وضع القطعة (استثناء لمنتج بلا سعر كرتون) يحوّل الكراتين المتوفرة
    // لعدد القطع المكافئ بالضرب في units.
    const canCarton = !!item.carton_price && !!item.units
    const unitMode = canCarton ? 'carton' : 'unit'
    const maxQty = unitMode === 'carton' ? item.qty : item.qty * (item.units || 1)

    setCart((prev) => {
      const existing = prev.find((c) => c.product_id === item.product_id)
      if (existing) {
        if (existing.qty >= existing.maxQty) {
          showToast(existing.unitMode === 'carton' ? `⚠️ أقصى كمية متوفرة بالكاميو: ${existing.maxQty} كرتون` : '⚠️ الكمية المتوفرة بالكاميو محدودة', true)
          return prev
        }
        return prev.map((c) => c.product_id === item.product_id ? { ...c, qty: c.qty + 1 } : c)
      }
      if (maxQty <= 0) {
        showToast(unitMode === 'carton' ? `⚠️ لا يوجد كرتون متوفر من "${item.name}" بالكاميو حالياً` : '⚠️ الكمية غير متوفرة بالكاميو', true)
        return prev
      }
      return [...prev, {
        product_id: item.product_id, name: item.name, price: item.price, image: item.image, qty: 1,
        maxQty, unitMode, cartonPrice: item.carton_price, units: item.units, brand_id: item.brand_id,
      }]
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
  const promoInput = cart.map((c) => ({ id: c.product_id, price: unitPrice(c), qty: c.qty, brand_id: c.brand_id }))
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
    // ✅ بيع بالكرتون فقط. بما أن مخزون الكاميو مُسجَّل بالكرتون أصلاً (مثل
    // باقي النظام)، عناصر الكرتون تُرسَل مباشرة بلا أي تحويل: qty=عدد
    // الكراتين، price=سعر الكرتون — تُطابق تمامًا وحدة "sell_van_stock".
    // الاستثناء الوحيد: منتج بلا سعر كرتون يُباع بالقطعة، فنرسل كسرًا من
    // الكرتون (qty/units) بسعر مكافئ (price×units) حتى يبقى الإجمالي
    // ونقصان مخزون الكاميو صحيحين معًا دون لمس دالة RPC.
    const items = cart.map((c) => {
      if (c.unitMode === 'carton') {
        return { product_id: c.product_id, name: c.name, price: c.cartonPrice, qty: c.qty, unit: 'carton' }
      }
      const units = c.units || 1
      return {
        product_id: c.product_id, name: c.name,
        price: +(c.price * units).toFixed(4), qty: +(c.qty / units).toFixed(6),
        unit: 'unit', display_qty: c.qty, unit_price: c.price,
      }
    })
    // ✅ نسخة مقروءة للفاتورة المطبوعة فقط (بالوحدة الطبيعية للزبون)،
    // مختلفة عن items فقط في حالة استثناء بيع القطعة (كسر الكرتون هناك
    // غير مقروء بشرياً على الفاتورة)
    const receiptItems = cart.map((c) => ({
      product_id: c.product_id, name: c.name,
      price: unitPrice(c), qty: c.qty, unit: c.unitMode === 'carton' ? 'carton' : 'unit',
    }))
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
      items: receiptItems,
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
    promoDiscount, appliedPromoNames, total, unitPrice,
    addToCart, cartQtyFor, updateQty, removeFromCart, completeSale,
  }
}
