import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'
import { T, cardStyle, buttonPrimary, buttonGhost, inputStyle } from '../lib/theme.js'
import { queueSale } from '../lib/offlineQueue.js'
import useOnlineStatus from '../hooks/useOnlineStatus.js'
import { printReceipt } from '../lib/printer.js'

export default function SellTab({ employee, showToast }) {
  const isOnline = useOnlineStatus()
  const [vanStock, setVanStock] = useState([])
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState([]) // [{product_id, name, price, qty, maxQty}]
  const [shopName, setShopName] = useState('')
  const [shopPhone, setShopPhone] = useState('')
  const [payMode, setPayMode] = useState('cash')
  const [saving, setSaving] = useState(false)
  const [lastReceipt, setLastReceipt] = useState(null)
  const [printing, setPrinting] = useState(false)

  const loadVanStock = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_van_stock', { p_employee_id: employee.id })
      if (error) throw error
      setVanStock(data || [])
    } catch (e) {
      console.error('❌ خطأ تحميل مخزون الكاميو:', e)
    }
  }, [employee.id])

  useEffect(() => { loadVanStock() }, [loadVanStock])

  const filtered = vanStock.filter(v => !search.trim() || v.name.toLowerCase().includes(search.trim().toLowerCase()))

  const addToCart = (item) => {
    setCart(prev => {
      const existing = prev.find(c => c.product_id === item.product_id)
      if (existing) {
        if (existing.qty >= item.qty) { showToast('⚠️ الكمية المتوفرة بالكاميو محدودة', true); return prev }
        return prev.map(c => c.product_id === item.product_id ? { ...c, qty: c.qty + 1 } : c)
      }
      return [...prev, { product_id: item.product_id, name: item.name, price: item.price, image: item.image, qty: 1, maxQty: item.qty }]
    })
  }

  const cartQtyFor = (id) => cart.find(c => c.product_id === id)?.qty || 0

  const updateQty = (id, delta) => {
    setCart(prev => prev.map(c => {
      if (c.product_id !== id) return c
      const newQty = c.qty + delta
      if (newQty <= 0) return c
      if (newQty > c.maxQty) { showToast('⚠️ الكمية المتوفرة بالكاميو محدودة', true); return c }
      return { ...c, qty: newQty }
    }).filter(c => c.qty > 0))
  }

  const removeFromCart = (id) => setCart(prev => prev.filter(c => c.product_id !== id))

  const total = cart.reduce((s, c) => s + c.price * c.qty, 0)

  const completeSale = async () => {
    if (saving) return // حماية من الضغط المزدوج قبل تفعّل الحالة بصريًا
    if (cart.length === 0) { showToast('⚠️ السلة فارغة', true); return }
    if (!shopName.trim()) { showToast('⚠️ أدخل اسم المحل', true); return }

    setSaving(true)
    const items = cart.map(c => ({ product_id: c.product_id, name: c.name, price: c.price, qty: c.qty }))
    const salePayload = {
      employee_id: employee.id,
      items,
      customer_name: shopName.trim(),
      customer_phone: shopPhone.trim() || null,
      pay_mode: payMode,
    }
    const receiptData = {
      shopName: shopName.trim(),
      shopPhone: shopPhone.trim(),
      employeeName: employee.name,
      date: new Date().toLocaleString('ar-DZ'),
      items,
      total,
      payMode,
    }

    const finishAsQueued = () => {
      queueSale(salePayload)
      // خصم تفاؤلي من المخزون المعروض محلياً حتى لا يُباع نفس الصنف
      // مرتين قبل مزامنة هذه العملية مع الخادم
      setVanStock(prev => prev.map(v => {
        const sold = items.find(i => i.product_id === v.product_id)
        return sold ? { ...v, qty: v.qty - sold.qty } : v
      }))
      showToast(`📡 لا يوجد اتصال — تم حفظ بيع ${shopName} محلياً وسيُرسل تلقائياً عند عودة الشبكة`, true)
      setCart([])
      setShopName('')
      setShopPhone('')
      setPayMode('cash')
      setLastReceipt(receiptData)
    }

    // بدون اتصال أصلاً؟ لا داعي لمحاولة الشبكة، نحفظ بالطابور مباشرة
    if (!isOnline) {
      finishAsQueued()
      setSaving(false)
      return
    }

    try {
      // ✅ نداء واحد ذرّي: يخصم كل الأصناف ويسجّل الطلب داخل معاملة
      // واحدة بقاعدة البيانات. لو فشل أي صنف (نقص كمية مثلاً)، تتراجع
      // كل العملية تلقائياً ولا يُخصم أي شيء ولا يُسجَّل طلب جزئي.
      // انظر supabase/complete_van_sale.sql
      const { error } = await supabase.rpc('complete_van_sale', {
        p_employee_id: employee.id,
        p_items: items,
        p_customer_name: shopName.trim(),
        p_customer_phone: shopPhone.trim() || null,
        p_pay_mode: payMode,
      })
      if (error) throw error

      showToast(`✅ تم تسجيل البيع لـ ${shopName} بقيمة ${total.toFixed(0)} دج`)
      setCart([])
      setShopName('')
      setShopPhone('')
      setPayMode('cash')
      setLastReceipt(receiptData)
      loadVanStock()
    } catch (e) {
      console.error('❌ خطأ إتمام البيع:', e)
      const isNetworkError = e?.message === 'Failed to fetch' || e?.name === 'TypeError'
      if (isNetworkError) {
        finishAsQueued()
      } else {
        showToast('❌ ' + (e.message || 'فشل إتمام البيع') + ' — لم يُخصم أي شيء من الكاميو', true)
      }
      // ملاحظة: بما أن complete_van_sale ذرّية، فشلها المنطقي يعني
      // عدم حدوث أي تغيير فعلي بالخادم، فلا حاجة لإعادة تحميل المخزون
    } finally {
      setSaving(false)
    }
  }

  const handlePrintLast = async () => {
    if (!lastReceipt || printing) return
    setPrinting(true)
    try {
      await printReceipt(lastReceipt)
      showToast('✅ أُرسلت الفاتورة للطابعة')
    } catch (e) {
      console.error('❌ خطأ الطباعة:', e)
      showToast('❌ ' + (e.message || 'فشلت الطباعة'), true)
    } finally {
      setPrinting(false)
    }
  }

  return (
    <div style={{ padding: '16px 16px 4px' }}>
      {lastReceipt && cart.length === 0 && (
        <button onClick={handlePrintLast} disabled={printing}
          style={{ ...buttonGhost, width: '100%', padding: 12, fontSize: 12.5, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          {printing ? '⏳ جارِ الطباعة...' : `🖨️ طباعة فاتورة ${lastReceipt.shopName}`}
        </button>
      )}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <span style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: T.textFaint }}>🔍</span>
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث في بضاعتك..."
          style={{ ...inputStyle, paddingRight: 40 }}
        />
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', color: T.textFaint, padding: '50px 20px' }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>{vanStock.length === 0 ? '📭' : '🔍'}</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            {vanStock.length === 0 ? 'الكاميو فاضي — حمّل منتجات من تبويب "تحميل"' : 'لا توجد نتائج مطابقة'}
          </div>
        </div>
      )}

      {/* شبكة المنتجات — تجربة شبيهة بمتجر نقاء */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: cart.length > 0 ? 380 : 20 }}>
        {filtered.map(v => {
          const inCart = cartQtyFor(v.product_id)
          return (
            <button key={v.product_id} onClick={() => addToCart(v)}
              style={{ ...cardStyle, padding: 0, overflow: 'hidden', border: inCart ? `2px solid ${T.primary}` : '2px solid transparent', textAlign: 'right', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column' }}>
              <div style={{ position: 'relative', aspectRatio: '1', background: T.bg }}>
                {v.image ? (
                  <img src={v.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>📦</div>
                )}
                <span style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(255,255,255,.95)', color: T.primary, borderRadius: T.radiusPill, padding: '3px 9px', fontSize: 10, fontWeight: 900, boxShadow: '0 1px 4px rgba(0,0,0,.1)' }}>
                  متوفر {v.qty}
                </span>
                {inCart > 0 && (
                  <span style={{ position: 'absolute', top: 8, right: 8, background: T.primary, color: 'white', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, boxShadow: '0 2px 6px rgba(234,88,12,.4)' }}>
                    {inCart}
                  </span>
                )}
              </div>
              <div style={{ padding: '10px 12px 12px' }}>
                <div style={{ fontWeight: 800, fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: T.text }}>{v.name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                  <span style={{ fontWeight: 900, fontSize: 14, color: T.primary }}>{v.price} <span style={{ fontSize: 10, fontWeight: 700 }}>دج</span></span>
                  <span style={{ background: T.primaryLight, color: T.primary, borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900 }}>+</span>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* السلة الثابتة بالأسفل */}
      {cart.length > 0 && (
        <div style={{ position: 'fixed', bottom: 0, right: 0, left: 0, maxWidth: 500, margin: '0 auto', background: 'white', borderRadius: '24px 24px 0 0', boxShadow: '0 -8px 30px rgba(15,23,42,.12)', padding: '18px 18px 96px', maxHeight: '70vh', overflowY: 'auto', zIndex: 30 }}>
          <div style={{ width: 40, height: 4, background: T.border, borderRadius: 4, margin: '0 auto 14px' }} />
          <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>🧾 فاتورة البيع</div>
          {cart.map(c => (
            <div key={c.product_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: `1px solid ${T.border}` }}>
              {c.image ? (
                <img src={c.image} alt="" style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
              ) : (
                <div style={{ width: 34, height: 34, borderRadius: 8, background: T.bg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>📦</div>
              )}
              <div style={{ flex: 1, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
              <button onClick={() => updateQty(c.product_id, -1)} style={{ width: 26, height: 26, borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: 'white', cursor: 'pointer', fontWeight: 700 }}>−</button>
              <span style={{ fontSize: 13, fontWeight: 800, minWidth: 18, textAlign: 'center' }}>{c.qty}</span>
              <button onClick={() => updateQty(c.product_id, 1)} style={{ width: 26, height: 26, borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: 'white', cursor: 'pointer', fontWeight: 700 }}>+</button>
              <span style={{ fontSize: 12, fontWeight: 800, color: T.primary, minWidth: 55, textAlign: 'left' }}>{(c.price * c.qty).toFixed(0)} دج</span>
              <button onClick={() => removeFromCart(c.product_id)} style={{ background: '#FEE2E2', color: T.danger, border: 'none', borderRadius: T.radiusSm, width: 26, height: 26, cursor: 'pointer', fontWeight: 700 }}>✕</button>
            </div>
          ))}

          <input value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="🏬 اسم المحل *"
            style={{ ...inputStyle, padding: 11, marginTop: 12, marginBottom: 8, fontSize: 13 }} />
          <input value={shopPhone} onChange={(e) => setShopPhone(e.target.value)} placeholder="📱 هاتف المحل (اختياري)"
            style={{ ...inputStyle, padding: 11, marginBottom: 10, fontSize: 13 }} />

          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {[{ v: 'cash', l: 'نقداً' }, { v: 'credit', l: 'آجل' }, { v: 'cheque', l: 'شيك' }].map(m => (
              <button key={m.v} onClick={() => setPayMode(m.v)}
                style={{ flex: 1, padding: 9, borderRadius: T.radiusSm, border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                  background: payMode === m.v ? T.primary : T.bg, color: payMode === m.v ? 'white' : T.textSoft, transition: 'all .15s' }}>
                {m.l}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 17, marginBottom: 12 }}>
            <span style={{ color: T.textSoft, fontSize: 13, alignSelf: 'center' }}>الإجمالي</span>
            <span style={{ color: T.primary }}>{total.toFixed(0)} دج</span>
          </div>

          <button disabled={saving} onClick={completeSale}
            style={{ ...buttonPrimary, width: '100%', padding: 15, fontSize: 15, background: saving ? T.textFaint : T.primaryGradient }}>
            {saving ? '⏳ جارِ الحفظ...' : '✅ إتمام البيع'}
          </button>
        </div>
      )}
    </div>
  )
}
