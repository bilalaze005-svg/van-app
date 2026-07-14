import { useState } from 'react'
import { configError } from './lib/supabase.js'
import { T } from './lib/theme.js'
import useToast from './hooks/useToast.jsx'
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

      {/* محتوى التبويب */}
      {tab === 'sell' && <SellTab employee={employee} showToast={showToast} />}
      {tab === 'load' && <LoadTab employee={employee} showToast={showToast} />}
      {tab === 'settlement' && <SettlementTab employee={employee} />}

      {/* شريط تنقّل سفلي */}
      <div style={{ position: 'fixed', bottom: 14, right: 14, left: 14, maxWidth: 470, margin: '0 auto', background: 'white', borderRadius: T.radiusPill, display: 'flex', padding: 6, boxShadow: '0 10px 30px rgba(15,23,42,.14)' }}>
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
