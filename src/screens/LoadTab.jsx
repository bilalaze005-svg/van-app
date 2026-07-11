import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'

export default function LoadTab({ employee, showToast }) {
  const [search, setSearch] = useState('')
  const [products, setProducts] = useState([])
  const [qtyMap, setQtyMap] = useState({}) // productId -> qty مُدخلة
  const [loadingId, setLoadingId] = useState(null)
  const [vanStock, setVanStock] = useState([])
  const [loadingList, setLoadingList] = useState(false)

  const searchProducts = useCallback(async () => {
    if (!search.trim()) { setProducts([]); return }
    setLoadingList(true)
    try {
      const like = `%${search.trim()}%`
      const { data, error } = await supabase
        .from('products')
        .select('id,name,price,stock,sku')
        .eq('disabled', false)
        .or(`name.ilike.${like},sku.ilike.${like}`)
        .order('name')
        .limit(20)
      if (error) throw error
      setProducts(data || [])
    } catch (e) {
      console.error('❌ خطأ البحث:', e)
    } finally {
      setLoadingList(false)
    }
  }, [search])

  useEffect(() => {
    const t = setTimeout(searchProducts, 350)
    return () => clearTimeout(t)
  }, [searchProducts])

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

  const doLoad = async (product) => {
    const qty = parseFloat(qtyMap[product.id])
    if (!qty || qty <= 0) { showToast('⚠️ أدخل كمية صحيحة أولاً', true); return }
    if (qty > product.stock) { showToast(`⚠️ الكمية بالمخزون الرئيسي (${product.stock}) أقل من المطلوب`, true); return }

    setLoadingId(product.id)
    try {
      const { error } = await supabase.rpc('load_van_stock', {
        p_employee_id: employee.id, p_product_id: product.id, p_qty: qty,
      })
      if (error) throw error
      showToast(`✅ تم تحميل ${qty} من ${product.name}`)
      setQtyMap(prev => ({ ...prev, [product.id]: '' }))
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, stock: p.stock - qty } : p))
      loadVanStock()
    } catch (e) {
      console.error('❌ خطأ التحميل:', e)
      showToast('❌ ' + (e.message || 'فشل التحميل'), true)
    } finally {
      setLoadingId(null)
    }
  }

  const vanTotalItems = vanStock.reduce((s, v) => s + Number(v.qty), 0)
  const vanTotalValue = vanStock.reduce((s, v) => s + Number(v.qty) * Number(v.price), 0)

  return (
    <div style={{ padding: 16 }}>
      {/* ملخص مخزون الكاميو الحالي */}
      <div style={{ background: 'linear-gradient(135deg,#EA580C,#C2410C)', borderRadius: 18, padding: 16, color: 'white', marginBottom: 16 }}>
        <div style={{ fontSize: 13, opacity: 0.85 }}>📦 مخزون الكاميو الحالي</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{vanStock.length}</div>
            <div style={{ fontSize: 11, opacity: 0.8 }}>منتج مختلف</div>
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{vanTotalItems.toFixed(0)}</div>
            <div style={{ fontSize: 11, opacity: 0.8 }}>قطعة إجمالاً</div>
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{vanTotalValue.toFixed(0)}</div>
            <div style={{ fontSize: 11, opacity: 0.8 }}>دج (قيمة تقديرية)</div>
          </div>
        </div>
      </div>

      {vanStock.length > 0 && (
        <div style={{ background: 'white', borderRadius: 14, padding: 12, marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8, color: '#475569' }}>محتوى الكاميو حالياً:</div>
          {vanStock.map(v => (
            <div key={v.product_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, borderBottom: '1px solid #F1F5F9' }}>
              <span>{v.name}</span>
              <span style={{ fontWeight: 700, color: '#EA580C' }}>{v.qty}</span>
            </div>
          ))}
        </div>
      )}

      {/* بحث وتحميل منتجات جديدة */}
      <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>➕ تحميل منتجات من المخزون الرئيسي</div>
      <input
        value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 ابحث باسم المنتج أو الباركود..."
        style={{ width: '100%', padding: 12, borderRadius: 14, border: '1.5px solid #E2E8F0', marginBottom: 12, fontSize: 14, fontFamily: 'inherit' }}
      />

      {loadingList && <div style={{ textAlign: 'center', color: '#94a3b8', padding: 20 }}>⏳ جارِ البحث...</div>}

      {products.map(p => (
        <div key={p.id} style={{ background: 'white', borderRadius: 14, padding: 12, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>متوفر بالمخزون: {p.stock} — {p.price} دج</div>
          </div>
          <input
            type="number" min="0" placeholder="الكمية"
            value={qtyMap[p.id] || ''}
            onChange={(e) => setQtyMap(prev => ({ ...prev, [p.id]: e.target.value }))}
            style={{ width: 70, padding: 8, borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 13, textAlign: 'center', fontFamily: 'inherit' }}
          />
          <button disabled={loadingId === p.id} onClick={() => doLoad(p)}
            style={{ background: loadingId === p.id ? '#FDBA74' : '#EA580C', color: 'white', border: 'none', borderRadius: 10, padding: '8px 12px', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
            {loadingId === p.id ? '⏳' : '⬆️ تحميل'}
          </button>
        </div>
      ))}

      {!loadingList && search.trim() && products.length === 0 && (
        <div style={{ textAlign: 'center', color: '#94a3b8', padding: 20 }}>لا توجد نتائج</div>
      )}
    </div>
  )
}
