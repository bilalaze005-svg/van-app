import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'

export default function SettlementTab({ employee }) {
  const [todaySales, setTodaySales] = useState([])
  const [vanStock, setVanStock] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const start = new Date(); start.setHours(0, 0, 0, 0)
      const [{ data: sales, error: salesErr }, { data: stock, error: stockErr }] = await Promise.all([
        supabase.from('orders')
          .select('id,customer_name,total,pay_mode,created_at')
          .eq('employee_id', employee.id)
          .gte('created_at', start.toISOString())
          .order('created_at', { ascending: false }),
        supabase.rpc('get_van_stock', { p_employee_id: employee.id }),
      ])
      if (salesErr) throw salesErr
      if (stockErr) throw stockErr
      setTodaySales(sales || [])
      setVanStock(stock || [])
    } catch (e) {
      console.error('❌ خطأ تحميل ملخص اليوم:', e)
    } finally {
      setLoading(false)
    }
  }, [employee.id])

  useEffect(() => { load() }, [load])

  const totalSales = todaySales.reduce((s, o) => s + Number(o.total), 0)
  const byMode = todaySales.reduce((acc, o) => {
    const m = o.pay_mode || 'cash'
    acc[m] = (acc[m] || 0) + Number(o.total)
    return acc
  }, {})
  const modeLabel = { cash: '💵 نقداً', credit: '📝 آجل', cheque: '🧾 شيك', transfer: '🏦 تحويل' }
  const vanTotalValue = vanStock.reduce((s, v) => s + Number(v.qty) * Number(v.price), 0)

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>⏳ جارِ التحميل...</div>

  return (
    <div style={{ padding: 16 }}>
      <div style={{ background: 'linear-gradient(135deg,#059669,#047857)', borderRadius: 18, padding: 18, color: 'white', marginBottom: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 13, opacity: 0.85 }}>💰 إجمالي مبيعات اليوم</div>
        <div style={{ fontSize: 32, fontWeight: 900, marginTop: 4 }}>{totalSales.toFixed(0)} <span style={{ fontSize: 16 }}>دج</span></div>
        <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>{todaySales.length} عملية بيع</div>
      </div>

      <div style={{ background: 'white', borderRadius: 14, padding: 14, marginBottom: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 10 }}>تفصيل حسب طريقة الدفع:</div>
        {Object.keys(byMode).length === 0 && <div style={{ color: '#94a3b8', fontSize: 13 }}>لا توجد مبيعات اليوم بعد</div>}
        {Object.entries(byMode).map(([mode, val]) => (
          <div key={mode} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F1F5F9', fontSize: 13 }}>
            <span>{modeLabel[mode] || mode}</span>
            <span style={{ fontWeight: 800 }}>{val.toFixed(0)} دج</span>
          </div>
        ))}
      </div>

      <div style={{ background: '#FFF7ED', borderRadius: 14, padding: 14, marginBottom: 16, border: '1px solid #FED7AA' }}>
        <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 6, color: '#C2410C' }}>📦 المتبقي بالكاميو الآن</div>
        <div style={{ fontSize: 12, color: '#9A3412' }}>{vanStock.length} منتج — قيمة تقديرية {vanTotalValue.toFixed(0)} دج</div>
        <div style={{ fontSize: 11, color: '#9A3412', marginTop: 6 }}>
          💡 قارن هذا مع العدّ الفعلي للبضاعة بالكاميو للتأكد من عدم وجود نقص
        </div>
      </div>

      <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8 }}>سجل مبيعات اليوم:</div>
      {todaySales.map(o => (
        <div key={o.id} style={{ background: 'white', borderRadius: 12, padding: 10, marginBottom: 6, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
          <div>
            <div style={{ fontWeight: 700 }}>{o.customer_name}</div>
            <div style={{ color: '#94a3b8' }}>{new Date(o.created_at).toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' })} — {modeLabel[o.pay_mode] || o.pay_mode}</div>
          </div>
          <div style={{ fontWeight: 800, color: '#059669' }}>{Number(o.total).toFixed(0)} دج</div>
        </div>
      ))}

      <button onClick={load} style={{ width: '100%', background: '#F1F5F9', border: 'none', borderRadius: 14, padding: 12, color: '#475569', fontWeight: 700, fontSize: 13, marginTop: 8, cursor: 'pointer', fontFamily: 'inherit' }}>
        🔄 تحديث
      </button>
    </div>
  )
}
