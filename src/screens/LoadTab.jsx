import { useState } from 'react'
import { T, cardStyle, buttonPrimary, inputStyle } from '../lib/theme.js'
import useLoadStock from '../hooks/useLoadStock.js'

export default function LoadTab({ employee, showToast }) {
  const [search, setSearch] = useState('')
  const [qtyMap, setQtyMap] = useState({})

  const { products, loadingList, loadingMore, hasMore, vanStock, loadingId, doLoad, loadMore } =
    useLoadStock({ employee, showToast, search })

  const handleLoad = async (product) => {
    const qty = parseFloat(qtyMap[product.id])
    const ok = await doLoad(product, qty)
    if (ok) setQtyMap((prev) => ({ ...prev, [product.id]: '' }))
  }

  const vanTotalItems = vanStock.reduce((s, v) => s + Number(v.qty), 0)
  const vanTotalValue = vanStock.reduce((s, v) => s + Number(v.qty) * Number(v.price), 0)

  return (
    <div style={{ padding: 16 }}>
      {/* ملخص مخزون الكاميو الحالي */}
      <div style={{ background: T.primaryGradient, borderRadius: T.radiusLg, padding: 18, color: 'white', marginBottom: 18, boxShadow: '0 8px 24px rgba(234,88,12,.28)' }}>
        <div style={{ fontSize: 12.5, opacity: 0.9, fontWeight: 600 }}>📦 مخزون الكاميو الحالي</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
          {[
            { v: vanStock.length, l: 'منتج مختلف' },
            { v: vanTotalItems.toFixed(0), l: 'قطعة إجمالاً' },
            { v: vanTotalValue.toFixed(0), l: 'دج (قيمة تقديرية)' },
          ].map((s, i) => (
            <div key={i}>
              <div style={{ fontSize: 22, fontWeight: 900 }}>{s.v}</div>
              <div style={{ fontSize: 10.5, opacity: 0.85, marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {vanStock.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: 18 }}>
          <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 10, color: T.textSoft }}>محتوى الكاميو حالياً</div>
          {vanStock.map((v) => (
            <div key={v.product_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: `1px solid ${T.border}` }}>
              {v.image ? (
                <img src={v.image} alt="" style={{ width: 30, height: 30, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
              ) : (
                <div style={{ width: 30, height: 30, borderRadius: 8, background: T.bg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>📦</div>
              )}
              <span style={{ flex: 1, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.name}</span>
              <span style={{ fontWeight: 800, color: T.primary, fontSize: 13 }}>{v.qty}</span>
            </div>
          ))}
        </div>
      )}

      {/* بحث وتحميل منتجات جديدة */}
      <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>➕ تحميل من المخزون الرئيسي</div>
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <span style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: T.textFaint }}>🔍</span>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث باسم المنتج أو الباركود..."
          style={{ ...inputStyle, paddingRight: 40 }} />
      </div>

      {loadingList && products.length === 0 && <div style={{ textAlign: 'center', color: T.textFaint, padding: 30 }}>⏳ جارِ التحميل...</div>}

      {!loadingList && !search.trim() && products.length > 0 && (
        <div style={{ fontSize: 12, color: T.textFaint, fontWeight: 700, marginBottom: 8 }}>📦 أحدث المنتجات</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {products.map((p) => (
          <div key={p.id} style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
            <div style={{ aspectRatio: '1.6', background: T.bg, position: 'relative' }}>
              {p.image ? (
                <img src={p.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>📦</div>
              )}
              <span style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(255,255,255,.95)', borderRadius: T.radiusPill, padding: '2px 8px', fontSize: 9.5, fontWeight: 900, color: T.textSoft }}>
                مخزون {p.stock}
              </span>
            </div>
            <div style={{ padding: 10 }}>
              <div style={{ fontWeight: 800, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 2 }}>{p.name}</div>
              <div style={{ fontSize: 11, color: T.textFaint, marginBottom: 8 }}>{p.price} دج</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="number" min="0" placeholder="كمية"
                  value={qtyMap[p.id] || ''}
                  onChange={(e) => setQtyMap((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  style={{ width: 0, flex: 1, padding: 7, borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, fontSize: 12, textAlign: 'center', fontFamily: 'inherit' }}
                />
                <button disabled={loadingId === p.id} onClick={() => handleLoad(p)}
                  style={{ ...buttonPrimary, padding: '7px 10px', fontSize: 12, flexShrink: 0, background: loadingId === p.id ? T.textFaint : T.primaryGradient }}>
                  {loadingId === p.id ? '⏳' : '⬆️'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {!loadingList && search.trim() && products.length === 0 && (
        <div style={{ textAlign: 'center', color: T.textFaint, padding: 30 }}>لا توجد نتائج</div>
      )}

      {!loadingList && hasMore && products.length > 0 && (
        <button onClick={loadMore} disabled={loadingMore}
          style={{ ...buttonPrimary, width: '100%', padding: 13, fontSize: 13, marginTop: 14, background: T.bg, color: T.textSoft, boxShadow: 'none' }}>
          {loadingMore ? '⏳ جارِ التحميل...' : 'تحميل المزيد'}
        </button>
      )}
    </div>
  )
}
