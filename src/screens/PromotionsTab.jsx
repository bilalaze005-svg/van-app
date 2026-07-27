import { T, cardStyle } from '../lib/theme.js'
import usePromotions from '../hooks/usePromotions.js'
import { describePromo } from '../lib/promotions.js'

/**
 * @file PromotionsTab.jsx
 * @description يعرض للموظف قائمة العروض النشطة حالياً (نفس بيانات جدول
 * promotions التي يُطبَّقها منطق البيع في useVanSale.js تلقائياً على الفاتورة)
 * حتى يكون على علم بها ويستطيع إخبار المحلات عنها أثناء البيع.
 */
export default function PromotionsTab() {
  const { data: promos, isLoading, isError, refetch } = usePromotions()

  const timeLeft = (endDate) => {
    if (!endDate) return null
    const diffMs = new Date(endDate).getTime() - Date.now()
    if (diffMs <= 0) return null
    const days = Math.floor(diffMs / 86400000)
    if (days >= 1) return `ينتهي خلال ${days} يوم`
    const hours = Math.floor(diffMs / 3600000)
    return hours >= 1 ? `ينتهي خلال ${hours} ساعة` : 'ينتهي اليوم'
  }

  return (
    <div style={{ padding: '16px 16px 90px' }}>
      <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 14 }}>🎯 العروض النشطة</div>

      {isLoading && (
        <div style={{ textAlign: 'center', color: T.textFaint, padding: 30 }}>⏳ جارِ التحميل...</div>
      )}

      {isError && (
        <div style={{ textAlign: 'center', padding: '30px 16px' }}>
          <div style={{ color: T.danger, fontSize: 13, marginBottom: 10 }}>⚠️ تعذّر تحميل العروض</div>
          <button onClick={() => refetch()}
            style={{ background: T.primaryLight, color: T.primary, border: 'none', borderRadius: T.radiusPill, padding: '8px 18px', fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }}>
            إعادة المحاولة
          </button>
        </div>
      )}

      {!isLoading && !isError && (!promos || promos.length === 0) && (
        <div style={{ textAlign: 'center', color: T.textFaint, padding: '50px 20px' }}>
          <div style={{ fontSize: 34, marginBottom: 10 }}>🎯</div>
          لا توجد عروض نشطة حالياً
        </div>
      )}

      {!isLoading && !isError && promos && promos.length > 0 && promos.map(p => {
        const left = timeLeft(p.end_date)
        return (
          <div key={p.id} style={{ ...cardStyle, marginBottom: 12, borderRight: `4px solid ${T.primary}` }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontWeight: 900, fontSize: 14.5 }}>{p.name}</div>
              {left && (
                <span style={{ fontSize: 10.5, fontWeight: 800, color: T.primaryDark, background: T.primaryLight, borderRadius: T.radiusPill, padding: '3px 9px', whiteSpace: 'nowrap' }}>
                  ⏱ {left}
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, color: T.textSoft, marginTop: 6, fontWeight: 700 }}>{describePromo(p)}</div>
            {p.description && (
              <div style={{ fontSize: 12, color: T.textFaint, marginTop: 6, lineHeight: 1.6 }}>{p.description}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}
