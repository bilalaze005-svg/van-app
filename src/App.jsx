import { useState, useEffect, useCallback } from 'react'
import { supabase, configError } from './lib/supabase.js'
import { T } from './lib/theme.js'
import useToast from './hooks/useToast.jsx'
import useOnlineStatus from './hooks/useOnlineStatus.js'
import { pendingCount, syncPendingSales } from './lib/offlineQueue.js'
import { checkEmployeeAccess } from './lib/session.js'
import LoginScreen from './screens/LoginScreen.jsx'
import LoadTab from './screens/LoadTab.jsx'
import SellTab from './screens/SellTab.jsx'
import SettlementTab from './screens/SettlementTab.jsx'

export default function App() {
  const [employee, setEmployee] = useState(() => {
    try { return JSON.parse(localStorage.getItem('nq_van_employee') || 'null') } catch { return null }
  })
  const [tab, setTab] = useState('sell')
  const [showToast, ToastUI] = useToast()
  const isOnline = useOnlineStatus()
  const [pending, setPending] = useState(() => pendingCount())
  const [syncing, setSyncing] = useState(false)

  const runSync = useCallback(async () => {
    if (syncing || pendingCount() === 0) return
    setSyncing(true)
    try {
      const { synced, failed } = await syncPendingSales(supabase)
      setPending(pendingCount())
      if (synced > 0) showToast(`✅ تمت مزامنة ${synced} عملية بيع كانت معلّقة`)
      if (failed > 0) showToast(`⚠️ ${failed} عملية بيع لم تُزامَن بعد — راجعها`, true)
    } finally {
      setSyncing(false)
    }
  }, [syncing, showToast])

  // مزامنة تلقائية عند عودة الاتصال وعند فتح التطبيق
  useEffect(() => {
    if (isOnline) runSync()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline])

  // تحديث عدّاد المعلّق كل مرة تتغيّر فيها السلة (بعد كل بيع جديد يُحفظ محلياً)
  useEffect(() => {
    const t = setInterval(() => setPending(pendingCount()), 4000)
    return () => clearInterval(t)
  }, [])

  // ✅ تحقق دوري: هل ما زال الموظف مصرَّحًا له باستخدام التطبيق؟ لو أُلغيت
  // صلاحيته من لوحة الإدارة، نسجّل خروجه تلقائيًا هنا بدل تركه يستخدم
  // التطبيق حتى يسجّل خروجه بنفسه. لا نسجّل الخروج عند فشل الشبكة (فقط
  // عند رفض صريح من الخادم) حتى لا نكسر تجربة العمل بدون إنترنت.
  useEffect(() => {
    if (!employee) return

    const runCheck = async () => {
      const { checked, hasAccess } = await checkEmployeeAccess(employee.id)
      if (checked && !hasAccess) {
        localStorage.removeItem('nq_van_employee')
        setEmployee(null)
        showToast('🚫 تم إلغاء صلاحية حسابك — تواصل مع الإدارة', true)
      }
    }

    runCheck() // تحقق فوري عند فتح التطبيق
    const interval = setInterval(runCheck, 5 * 60 * 1000) // كل 5 دقائق
    const onVisible = () => { if (document.visibilityState === 'visible') runCheck() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee?.id])

  if (configError) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <div>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <p style={{ color: T.danger, fontSize: 14 }}>{configError}</p>
        </div>
      </div>
    )
  }

  const handleLogout = () => {
    localStorage.removeItem('nq_van_employee')
    setEmployee(null)
  }

  if (!employee) return <LoginScreen onLogin={setEmployee} />

  const TABS = [
    { id: 'sell', icon: '🛒', label: 'بيع' },
    { id: 'load', icon: '⬆️', label: 'تحميل' },
    { id: 'settlement', icon: '📊', label: 'محاسبة' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: T.bg, paddingBottom: 78 }}>
      {ToastUI}

      {/* الهيدر */}
      <div style={{ background: T.primaryGradient, padding: '20px 18px 22px', color: 'white', borderRadius: '0 0 28px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 6px 20px rgba(234,88,12,.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 42, height: 42, borderRadius: 14, background: 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🚚</div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 15 }}>{employee.name}</div>
            <div style={{ fontSize: 11, opacity: 0.85 }}>التاجر المتنقل</div>
          </div>
        </div>
        <button onClick={handleLogout} style={{ background: 'rgba(255,255,255,.16)', border: 'none', borderRadius: T.radiusPill, padding: '8px 16px', color: 'white', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          خروج
        </button>
      </div>

      {/* بانر حالة الاتصال / المبيعات المعلّقة */}
      {(!isOnline || pending > 0) && (
        <div style={{
          margin: '12px 16px 0', padding: '10px 14px', borderRadius: 14, fontSize: 12, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          background: isOnline ? '#FEF3C7' : '#FEE2E2', color: isOnline ? '#92400E' : T.danger,
        }}>
          <span>
            {!isOnline && '📡 غير متصل بالإنترنت'}
            {isOnline && pending > 0 && `🔄 ${pending} عملية بيع بانتظار المزامنة`}
          </span>
          {isOnline && pending > 0 && (
            <button onClick={runSync} disabled={syncing}
              style={{ background: 'white', border: 'none', borderRadius: T.radiusPill, padding: '5px 12px', fontSize: 11, fontWeight: 800, cursor: 'pointer', color: T.primary }}>
              {syncing ? '⏳' : 'مزامنة الآن'}
            </button>
          )}
        </div>
      )}

      {/* محتوى التبويب */}
      {tab === 'sell' && <SellTab employee={employee} showToast={showToast} />}
      {tab === 'load' && <LoadTab employee={employee} showToast={showToast} />}
      {tab === 'settlement' && <SettlementTab employee={employee} />}

      {/* شريط تنقّل سفلي */}
      <div style={{ position: 'fixed', bottom: 14, right: 14, left: 14, maxWidth: 470, margin: '0 auto', background: 'white', borderRadius: T.radiusPill, display: 'flex', padding: 6, boxShadow: '0 10px 30px rgba(15,23,42,.14)', zIndex: 20 }}>
        {TABS.map(t => {
          const active = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                flex: 1, background: active ? T.primaryGradient : 'transparent', border: 'none', borderRadius: T.radiusPill,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', fontFamily: 'inherit',
                padding: '10px 0', transition: 'all .2s ease',
                boxShadow: active ? '0 4px 12px rgba(234,88,12,.35)' : 'none',
              }}>
              <span style={{ fontSize: 16 }}>{t.icon}</span>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: active ? 'white' : T.textFaint }}>{t.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
