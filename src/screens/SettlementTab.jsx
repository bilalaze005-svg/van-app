import { useState } from 'react'
import { T, cardStyle, buttonGhost } from '../lib/theme.js'
import { PERIODS, MODE_LABEL, totalSales, salesByMode, vanStockValue } from '../lib/settlementCalc.js'
import useSettlement from '../hooks/useSettlement.js'

export default function SettlementTab({ employee }) {
  const [period, setPeriod] = useState('day')
  const { sales, vanStock, loading, reload } = useSettlement({ employee, period })

  if (loading) return <div style={{ textAlign: 'center', padding: 50, color: T.textFaint }}>⏳ جارِ التحميل...</div>

  const total = totalSales(sales)
  const byMode = salesByMode(sales)
  const stockValue = vanStockValue(vanStock)

  return (
    <div style={{ padding: 16 }}>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {Object.entries(PERIODS).map(([key, p]) => (
          <button key={key} onClick={() => setPeriod(key)}
            style={{ flex: 1, padding: 10, borderRadius: T.radiusSm, border: 'none', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
              background: period === key ? T.primary : 'white', color: period === key ? 'white' : T.textSoft, boxShadow: period === key ? '0 4px 12px rgba(234,88,12,.25)' : '0 1px 3px rgba(0,0,0,.06)' }}>
            {p.label}
          </button>
        ))}
      </div>

      <div style={{ background: 'linear-gradient(135deg,#10B981,#047857)', borderRadius: T.radiusLg, padding: 22, color: 'white', marginBottom: 18, textAlign: 'center', boxShadow: '0 8px 24px rgba(5,150,105,.28)' }}>
        <div style={{ fontSize: 12.5, opacity: 0.9, fontWeight: 600 }}>💰 إجمالي مبيعات {PERIODS[period].label}</div>
        <div style={{ fontSize: 34, fontWeight: 900, marginTop: 6 }}>{total.toFixed(0)} <span style={{ fontSize: 16 }}>دج</span></div>
        <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>{sales.length} عملية بيع</div>
      </div>

      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 12 }}>تفصيل حسب طريقة الدفع</div>
        {Object.keys(byMode).length === 0 && <div style={{ color: T.textFaint, fontSize: 13 }}>لا توجد مبيعات في هذه الفترة بعد</div>}
        {Object.entries(byMode).map(([mode, val]) => (
          <div key={mode} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${T.border}`, fontSize: 13 }}>
            <span>{MODE_LABEL[mode] || mode}</span>
            <span style={{ fontWeight: 800 }}>{val.toFixed(0)} دج</span>
          </div>
        ))}
      </div>

      <div style={{ background: T.primaryLight, borderRadius: T.radiusLg, padding: 16, marginBottom: 16, border: '1px solid #FED7AA' }}>
        <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 6, color: T.primaryDark }}>📦 المتبقي بالكاميو الآن</div>
        <div style={{ fontSize: 12, color: '#9A3412' }}>{vanStock.length} منتج — قيمة تقديرية {stockValue.toFixed(0)} دج</div>
        <div style={{ fontSize: 11, color: '#9A3412', marginTop: 6, opacity: 0.85 }}>
          💡 قارن هذا مع العدّ الفعلي للبضاعة بالكاميو للتأكد من عدم وجود نقص
        </div>
      </div>

      <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 10 }}>سجل مبيعات {PERIODS[period].label}</div>
      {sales.length === 0 && (
        <div style={{ textAlign: 'center', color: T.textFaint, padding: '30px 0', fontSize: 13 }}>لا توجد عمليات بيع في هذه الفترة</div>
      )}
      {sales.map((o) => (
        <div key={o.id} style={{ ...cardStyle, padding: 12, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 12.5 }}>{o.customer_name}</div>
            <div style={{ color: T.textFaint, fontSize: 11, marginTop: 2 }}>
              {period !== 'day' && `${new Date(o.created_at).toLocaleDateString('ar-DZ')} — `}
              {new Date(o.created_at).toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' })} — {MODE_LABEL[o.pay_mode] || o.pay_mode}
            </div>
          </div>
          <div style={{ fontWeight: 800, color: T.success, alignSelf: 'center' }}>{Number(o.total).toFixed(0)} دج</div>
        </div>
      ))}

      <button onClick={reload} style={{ ...buttonGhost, width: '100%', padding: 13, fontSize: 13, marginTop: 8 }}>
        🔄 تحديث
      </button>
    </div>
  )
}
