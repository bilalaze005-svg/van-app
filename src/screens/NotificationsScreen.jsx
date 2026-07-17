import { T, cardStyle } from '../lib/theme.js'

export default function NotificationsScreen({ notifications, loading, onBack }) {
  const timeAgo = (iso) => {
    const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
    if (diffMin < 1) return 'الآن'
    if (diffMin < 60) return `منذ ${diffMin} د`
    const diffH = Math.round(diffMin / 60)
    if (diffH < 24) return `منذ ${diffH} س`
    return new Date(iso).toLocaleDateString('ar-DZ')
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bg }}>
      <div style={{ background: 'white', padding: '18px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${T.border}`, position: 'sticky', top: 0, zIndex: 5 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: T.text }}>→</button>
        <div style={{ fontWeight: 900, fontSize: 15 }}>🔔 الإشعارات</div>
        <div style={{ width: 20 }} />
      </div>

      <div style={{ padding: 16 }}>
        {loading && <div style={{ textAlign: 'center', color: T.textFaint, padding: 30 }}>⏳ جارِ التحميل...</div>}

        {!loading && notifications.length === 0 && (
          <div style={{ textAlign: 'center', color: T.textFaint, padding: '50px 20px' }}>
            <div style={{ fontSize: 34, marginBottom: 10 }}>🔕</div>
            لا توجد إشعارات بعد
          </div>
        )}

        {notifications.map(n => (
          <div key={n.id} style={{ ...cardStyle, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: T.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>📢</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 13.5 }}>{n.title}</div>
                {n.body && <div style={{ fontSize: 12.5, color: T.textSoft, marginTop: 4, lineHeight: 1.6 }}>{n.body}</div>}
                <div style={{ fontSize: 11, color: T.textFaint, marginTop: 6 }}>{timeAgo(n.created_at)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
