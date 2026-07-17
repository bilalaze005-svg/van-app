import { useState, useEffect, useCallback } from 'react'
import { supabase, configError } from './lib/supabase.js'
import { T } from './lib/theme.js'
import useToast from './hooks/useToast.jsx'
import useOnlineStatus from './hooks/useOnlineStatus.js'
import { pendingCount, syncPendingSales } from './lib/offlineQueue.js'
import { checkEmployeeAccess } from './lib/session.js'
import { fetchNotifications, countUnread, markAllSeen } from './lib/notifications.js'
import LoginScreen from './screens/LoginScreen.jsx'
import LoadTab from './screens/LoadTab.jsx'
import SellTab from './screens/SellTab.jsx'
import SettlementTab from './screens/SettlementTab.jsx'
import PrinterSettingsScreen from './screens/PrinterSettingsScreen.jsx'
import NotificationsScreen from './screens/NotificationsScreen.jsx'

export default function App() {
  const [employee, setEmployee] = useState(() => {
    try { return JSON.parse(localStorage.getItem('nq_van_employee') || 'null') } catch { return null }
  })
  const [tab, setTab] = useState('sell')
  const [showToast, ToastUI] = useToast()
  const isOnline = useOnlineStatus()
  const [pending, setPending] = useState(() => pendingCount())
  const [syncing, setSyncing] = useState(false)
  const [screen, setScreen] = useState(null) // null | 'printer' | 'notifications'
  const [notifications, setNotifications] = useState([])
  const [notifLoading, setNotifLoading] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  const loadNotifications = useCallback(async () => {
    if (!employee?.id) return
    try {
      const list = await fetchNotifications(employee.id)
      setNotifications(list)
      setUnreadCount(countUnread(employee.id, list))
    } catch (e) {
      console.error('❌ خطأ تحميل الإشعارات:', e)
    }
  }, [employee?.id])

  // تحميل الإشعارات عند الدخول، وتحديث دوري كل دقيقتين
  useEffect(() => {
    if (!employee) return
    loadNotifications()
    const t = setInterval(loadNotifications, 2 * 60 * 1000)
    return () => clearInterval(t)
  }, [employee, loadNotifications])

  const openNotifications = async () => {
    setScreen('notifications')
    setNotifLoading(true)
    try {
      const list = await fetchNotifications(employee.id)
      setNotifications(list)
      if (list[0]) markAllSeen(employee.id, list[0].id)
      setUnreadCount(0)
    } catch (e) {
      console.error('❌ خطأ تحميل الإشعارات:', e)
    } finally {
      setNotifLoading(false)
    }
  }

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

  // ⚠️ تحقق دوري: هل ما زال الموظف مصرَّحًا له باستخدام التطبيق؟
  // مُعطَّل مؤقتاً (تسجيل خروج تلقائي) لأن استعلام check_employee_access.sql
  // كان يخمّن اسم عمود الصلاحيات، وقد لا يطابق بنية جدولك الفعلية، مما كان
  // يسجّل خروج الموظف خطأً فور الدخول. نكتفي الآن بتسجيل النتيجة في الكونسول
  // فقط دون أي إجراء على المستخدم، حتى نتأكد من الشكل الصحيح للبيانات ثم
  // نعيد تفعيل تسجيل الخروج التلقائي بأمان.
  useEffect(() => {
    if (!employee) return

    const runCheck = async () => {
      const { checked, hasAccess } = await checkEmployeeAccess(employee.id)
      console.log('🔍 [تشخيص مؤقت] نتيجة التحقق من الصلاحية:', { checked, hasAccess })
      // TODO: أعد تفعيل السطرين التاليين بعد التأكد من صحة بنية الصلاحيات
      // if (checked && !hasAccess) {
      //   localStorage.removeItem('nq_van_employee')
      //   setEmployee(null)
      //   showToast('🚫 تم إلغاء صلاحية حسابك — تواصل مع الإدارة', true)
      // }
    }

    runCheck() // تحقق فوري عند فتح التطبيق (تشخيصي فقط الآن)
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setScreen('printer')} aria-label="إعدادات الطباعة"
            style={{ background: 'rgba(255,255,255,.16)', border: 'none', borderRadius: '50%', width: 38, height: 38, color: 'white', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            🖨️
          </button>
          <button onClick={openNotifications} aria-label="الإشعارات"
            style={{ background: 'rgba(255,255,255,.16)', border: 'none', borderRadius: '50%', width: 38, height: 38, color: 'white', fontSize: 16, cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            🔔
            {unreadCount > 0 && (
              <span style={{ position: 'absolute', top: -2, left: -2, background: T.danger, color: 'white', borderRadius: '50%', minWidth: 16, height: 16, fontSize: 9.5, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', border: '2px solid ' + T.primary }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          <button onClick={handleLogout} style={{ background: 'rgba(255,255,255,.16)', border: 'none', borderRadius: T.radiusPill, padding: '8px 16px', color: 'white', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            خروج
          </button>
        </div>
      </div>

      {screen === 'printer' && <PrinterSettingsScreen onBack={() => setScreen(null)} showToast={showToast} />}
      {screen === 'notifications' && (
        <NotificationsScreen notifications={notifications} loading={notifLoading} onBack={() => setScreen(null)} />
      )}

      {!screen && (
      <>
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
      </>
      )}
    </div>
  )
}
