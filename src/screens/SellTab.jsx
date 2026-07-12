import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'

export default function SellTab({ employee, showToast }) {
  const [vanStock, setVanStock] = useState([])
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState([]) // [{product_id, name, price, qty, maxQty}]
  const [shopName, setShopName] = useState('')
  const [shopPhone, setShopPhone] = useState('')
  const [payMode, setPayMode] = useState('cash')
  const [saving, setSaving] = useState(false)

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
      return [...prev, { product_id: item.product_id, name: item.name, price: item.price, qty: 1, maxQty: item.qty }]
    })
  }

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
    if (cart.length === 0) { showToast('⚠️ السلة فارغة', true); return }
    if (!shopName.trim()) { showToast('⚠️ أدخل اسم المحل', true); return }

    setSaving(true)
    try {
      // خصم الكميات من مخزون الكاميو (بالتتابع، ذرّي لكل منتج)
      for (const item of cart) {
        const { error } = await supabase.rpc('sell_van_stock', {
          p_employee_id: employee.id, p_product_id: item.product_id, p_qty: item.qty,
        })
        if (error) throw new Error(`فشل خصم ${item.name}: ${error.message}`)
      }

      // إنشاء الطلبية/الفاتورة
      const items = cart.map(c => ({ product_id: c.product_id, name: c.name, quantity: c.qty, price: c.price, total: c.price * c.qty }))
      const { error: orderErr } = await supabase.from('orders').insert({
        customer_name: shopName.trim(),
        customer_phone: shopPhone.trim() || null,
        items: JSON.stringify(items),
        total,
        status: 'delivered',
        pay_mode: payMode,
        paid_amount: payMode === 'credit' ? 0 : total,
        employee_id: employee.id,
        confirmed_at: new Date().toISOString(),
        confirmed_by: employee.id,
        created_at: new Date().toISOString(),
      })
      if (orderErr) throw orderErr

      showToast(`✅ تم تسجيل البيع لـ ${shopName} بقيمة ${total.toFixed(0)} دج`)
      setCart([])
      setShopName('')
      setShopPhone('')
      setPayMode('cash')
      loadVanStock()
    } catch (e) {
      console.error('❌ خطأ إتمام البيع:', e)
      showToast('❌ ' + (e.message || 'فشل إتمام البيع') + ' — راجع مخزون الكاميو، قد يكون جزء من الكمية خُصم', true)
      loadVanStock()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>🛒 اختر المنتجات من مخزون الكاميو</div>
      <input
        value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 بحث..."
        style={{ width: '100%', padding: 12, borderRadius: 14, border: '1.5px solid #E2E8F0', marginBottom: 12, fontSize: 14, fontFamily: 'inherit' }}
      />

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', color: '#94a3b8', padding: 20 }}>
          {vanStock.length === 0 ? '📭 الكاميو فاضي — حمّل منتجات أولاً من تبويب "تحميل"' : 'لا توجد نتائج'}
        </div>
      )}

      {filtered.map(v => (
        <button key={v.product_id} onClick={() => addToCart(v)}
          style={{ width: '100%', background: 'white', borderRadius: 14, padding: 10, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'right' }}>
          {v.image ? (
            <img src={v.image} alt="" style={{ width: 46, height: 46, objectFit: 'cover', borderRadius: 10, flexShrink: 0, background: '#F8FAFC' }} />
          ) : (
            <div style={{ width: 46, height: 46, borderRadius: 10, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>📦</div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{v.name}</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>متوفر بالكاميو: {v.qty} — {v.price} دج</div>
          </div>
          <span style={{ background: '#FFF7ED', color: '#EA580C', borderRadius: 10, padding: '6px 12px', fontWeight: 800, fontSize: 18, flexShrink: 0 }}>+</span>
        </button>
      ))}

      {/* السلة الثابتة بالأسفل */}
      {cart.length > 0 && (
        <div style={{ position: 'fixed', bottom: 0, right: 0, left: 0, maxWidth: 500, margin: '0 auto', background: 'white', borderRadius: '20px 20px 0 0', boxShadow: '0 -4px 20px rgba(0,0,0,.12)', padding: 16, maxHeight: '55vh', overflowY: 'auto' }}>
          <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 10 }}>🧾 الفاتورة</div>
          {cart.map(c => (
            <div key={c.product_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #F1F5F9' }}>
              <div style={{ flex: 1, fontSize: 12, fontWeight: 700 }}>{c.name}</div>
              <button onClick={() => updateQty(c.product_id, -1)} style={{ width: 26, height: 26, borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer' }}>−</button>
              <span style={{ fontSize: 13, fontWeight: 800, minWidth: 20, textAlign: 'center' }}>{c.qty}</span>
              <button onClick={() => updateQty(c.product_id, 1)} style={{ width: 26, height: 26, borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer' }}>+</button>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#EA580C', minWidth: 55, textAlign: 'left' }}>{(c.price * c.qty).toFixed(0)} دج</span>
              <button onClick={() => removeFromCart(c.product_id)} style={{ background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: 8, width: 26, height: 26, cursor: 'pointer' }}>✕</button>
            </div>
          ))}

          <input value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="🏬 اسم المحل *"
            style={{ width: '100%', padding: 10, borderRadius: 10, border: '1.5px solid #E2E8F0', marginTop: 10, marginBottom: 8, fontSize: 13, fontFamily: 'inherit' }} />
          <input value={shopPhone} onChange={(e) => setShopPhone(e.target.value)} placeholder="📱 هاتف المحل (اختياري)"
            style={{ width: '100%', padding: 10, borderRadius: 10, border: '1.5px solid #E2E8F0', marginBottom: 8, fontSize: 13, fontFamily: 'inherit' }} />

          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {[{ v: 'cash', l: 'نقداً' }, { v: 'credit', l: 'آجل' }, { v: 'cheque', l: 'شيك' }].map(m => (
              <button key={m.v} onClick={() => setPayMode(m.v)}
                style={{ flex: 1, padding: 8, borderRadius: 10, border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                  background: payMode === m.v ? '#EA580C' : '#F1F5F9', color: payMode === m.v ? 'white' : '#475569' }}>
                {m.l}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 16, marginBottom: 10 }}>
            <span>الإجمالي:</span>
            <span style={{ color: '#EA580C' }}>{total.toFixed(0)} دج</span>
          </div>

          <button disabled={saving} onClick={completeSale}
            style={{ width: '100%', padding: 14, borderRadius: 14, border: 'none', background: saving ? '#FDBA74' : '#059669', color: 'white', fontWeight: 900, fontSize: 15, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit' }}>
            {saving ? '⏳ جارِ الحفظ...' : '✅ إتمام البيع'}
          </button>
        </div>
      )}
    </div>
  )
}
