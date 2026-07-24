import { useState } from 'react'
import { T, cardStyle, buttonPrimary, buttonGhost, inputStyle } from '../lib/theme.js'
import useOnlineStatus from '../hooks/useOnlineStatus.js'
import { printReceipt, getAutoPrint } from '../lib/printer.js'
import useVanSale from '../hooks/useVanSale.js'

export default function SellTab({ employee, showToast }) {
  const isOnline = useOnlineStatus()
  const [search, setSearch] = useState('')
  const [shopName, setShopName] = useState('')
  const [shopPhone, setShopPhone] = useState('')
  const [payMode, setPayMode] = useState('cash')
  const [printing, setPrinting] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)

  const {
    vanStock, cart, saving, lastReceipt, setLastReceipt,
    promoDiscount, appliedPromoNames, total, unitPrice,
    addToCart, cartQtyFor, updateQty, removeFromCart, completeSale,
  } = useVanSale({ employee, showToast, isOnline })

  const filtered = vanStock
    .filter((v) => Number(v.qty) > 0)
    .filter((v) => !search.trim() || v.name.toLowerCase().includes(search.trim().toLowerCase()))

  const autoPrintIfEnabled = (data) => {
    if (!getAutoPrint()) return
    printReceipt(data)
      .then(() => showToast('🖨️ طُبعت الفاتورة تلقائياً'))
      .catch((e) => {
        console.error('❌ فشلت الطباعة التلقائية:', e)
        showToast('⚠️ فشلت الطباعة التلقائية — استخدم زر الطباعة يدوياً', true)
      })
  }

  const handleCompleteSale = async () => {
    try {
      const result = await completeSale({ shopName, shopPhone, payMode })
      if (!result) return // فشل تحقق بسيط (سلة فارغة/اسم فارغ) — رسالته ظهرت من داخل الـhook

      if (result.queued) {
        showToast(`📡 لا يوجد اتصال — تم حفظ بيع ${shopName} محلياً وسيُرسل تلقائياً عند عودة الشبكة`, true)
      } else {
        showToast(`✅ تم تسجيل البيع لـ ${shopName} بقيمة ${total.toFixed(0)} دج`)
      }
      setShopName('')
      setShopPhone('')
      setPayMode('cash')
      setCartOpen(false)
      autoPrintIfEnabled(result.receiptData)
    } catch (e) {
      console.error('❌ خطأ إتمام البيع:', e)
      showToast('❌ ' + (e.message || 'فشل إتمام البيع') + ' — لم يُخصم أي شيء من الكاميو', true)
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: cart.length > 0 ? 90 : 20 }}>
        {filtered.map((v) => {
          const inCart = cartQtyFor(v.product_id)
          const isCarton = !!v.carton_price && !!v.units
          // ✅ v.qty القادم من get_van_stock هو بالكرتون مباشرة (نفس اصطلاح
          // النظام كله)؛ استثناء القطعة فقط يحوّله لعدد القطع المكافئ للعرض
          const availDisplay = isCarton ? v.qty : v.qty * (v.units || 1)
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
                  متوفر {availDisplay}{isCarton ? ' كرتون' : ''}
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
                  <span style={{ fontWeight: 900, fontSize: 14, color: T.primary }}>{isCarton ? v.carton_price : v.price} <span style={{ fontSize: 10, fontWeight: 700 }}>دج</span></span>
                  <span style={{ background: T.primaryLight, color: T.primary, borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900 }}>+</span>
                </div>
                <div style={{ fontSize: 10, color: isCarton ? T.primary : T.textFaint, marginTop: 3, fontWeight: isCarton ? 800 : 400 }}>
                  {isCarton ? `🧃 يُباع بالكرتون (${v.units} وحدة)` : 'يُباع بالقطعة'}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* السلة القابلة للطي */}
      {cart.length > 0 && !cartOpen && (
        <button onClick={() => setCartOpen(true)}
          style={{
            position: 'fixed', bottom: 86, right: 14, left: 14, maxWidth: 470, margin: '0 auto',
            background: T.primaryGradient, color: 'white', border: 'none', borderRadius: T.radiusPill,
            padding: '13px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            boxShadow: '0 10px 26px rgba(234,88,12,.35)', zIndex: 25, cursor: 'pointer', fontFamily: 'inherit',
          }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 13.5 }}>
            <span style={{ background: 'rgba(255,255,255,.25)', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900 }}>
              {cart.reduce((s, c) => s + c.qty, 0)}
            </span>
            🛒 عرض السلة
          </span>
          <span style={{ fontWeight: 900, fontSize: 14.5 }}>{total.toFixed(0)} دج ‹</span>
        </button>
      )}

      {cart.length > 0 && cartOpen && (
        <>
          <div onClick={() => setCartOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.35)', zIndex: 29 }} />

          <div style={{ position: 'fixed', bottom: 0, right: 0, left: 0, maxWidth: 500, margin: '0 auto', background: 'white', borderRadius: '24px 24px 0 0', boxShadow: '0 -8px 30px rgba(15,23,42,.12)', padding: '10px 18px 96px', maxHeight: '80vh', overflowY: 'auto', zIndex: 30 }}>
            <button onClick={() => setCartOpen(false)} aria-label="طي السلة"
              style={{ width: '100%', background: 'none', border: 'none', padding: '6px 0 12px', cursor: 'pointer' }}>
              <div style={{ width: 40, height: 4, background: T.border, borderRadius: 4, margin: '0 auto' }} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontWeight: 900, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>🧾 فاتورة البيع</div>
              <button onClick={() => setCartOpen(false)}
                style={{ background: T.bg, border: 'none', borderRadius: T.radiusPill, padding: '6px 14px', fontSize: 12, fontWeight: 800, color: T.textSoft, cursor: 'pointer' }}>
                طي ▾
              </button>
            </div>
            {cart.map((c) => (
              <div key={c.product_id} style={{ padding: '8px 0', borderBottom: `1px solid ${T.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {c.image ? (
                    <img src={c.image} alt="" style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: T.bg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>📦</div>
                  )}
                  <div style={{ flex: 1, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                  <button onClick={() => updateQty(c.product_id, -1)} style={{ width: 26, height: 26, borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: 'white', cursor: 'pointer', fontWeight: 700 }}>−</button>
                  <span style={{ fontSize: 13, fontWeight: 800, minWidth: 18, textAlign: 'center' }}>{c.qty}</span>
                  <button onClick={() => updateQty(c.product_id, 1)} style={{ width: 26, height: 26, borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: 'white', cursor: 'pointer', fontWeight: 700 }}>+</button>
                  <span style={{ fontSize: 12, fontWeight: 800, color: T.primary, minWidth: 55, textAlign: 'left' }}>{(unitPrice(c) * c.qty).toFixed(0)} دج</span>
                  <button onClick={() => removeFromCart(c.product_id)} style={{ background: '#FEE2E2', color: T.danger, border: 'none', borderRadius: T.radiusSm, width: 26, height: 26, cursor: 'pointer', fontWeight: 700 }}>✕</button>
                </div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: c.unitMode === 'carton' ? T.primary : T.textFaint, padding: '4px 42px 0 0' }}>
                  {c.unitMode === 'carton' ? `🧃 بالكرتون (${c.units} وحدة/كرتون)` : '🔹 بالقطعة'}
                </div>
              </div>
            ))}

            <input value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="🏬 اسم المحل *"
              style={{ ...inputStyle, padding: 11, marginTop: 12, marginBottom: 8, fontSize: 13 }} />
            <input value={shopPhone} onChange={(e) => setShopPhone(e.target.value)} placeholder="📱 هاتف المحل (اختياري)"
              style={{ ...inputStyle, padding: 11, marginBottom: 10, fontSize: 13 }} />

            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {[{ v: 'cash', l: 'نقداً' }, { v: 'credit', l: 'آجل' }, { v: 'cheque', l: 'شيك' }].map((m) => (
                <button key={m.v} onClick={() => setPayMode(m.v)}
                  style={{ flex: 1, padding: 9, borderRadius: T.radiusSm, border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                    background: payMode === m.v ? T.primary : T.bg, color: payMode === m.v ? 'white' : T.textSoft, transition: 'all .15s' }}>
                  {m.l}
                </button>
              ))}
            </div>

            {promoDiscount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 13, marginBottom: 8, color: '#EA580C' }}>
                <span>🎯 خصم عروض ({appliedPromoNames.join('، ')})</span>
                <span>-{promoDiscount.toFixed(0)} دج</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 17, marginBottom: 12 }}>
              <span style={{ color: T.textSoft, fontSize: 13, alignSelf: 'center' }}>الإجمالي</span>
              <span style={{ color: T.primary }}>{total.toFixed(0)} دج</span>
            </div>

            <button disabled={saving} onClick={handleCompleteSale}
              style={{ ...buttonPrimary, width: '100%', padding: 15, fontSize: 15, background: saving ? T.textFaint : T.primaryGradient }}>
              {saving ? '⏳ جارِ الحفظ...' : '✅ إتمام البيع'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
