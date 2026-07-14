import { useState } from 'react'
import { configError } from './lib/supabase.js'
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
          <p style={{ color: '#DC2626', fontSize: 14 }}>{configError}</p>
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
    <div style={{ minHeight: '100vh', paddingBottom: 70 }}>
      {ToastUI}

      {/* الهيدر */}
      <div style={{ background: 'linear-gradient(135deg,#EA580C,#C2410C)', padding: '18px 18px 14px', color: 'white', borderRadius: '0 0 20px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 16 }}>🚚 {employee.name}</div>
          <div style={{ fontSize: 11, opacity: 0.85 }}>التاجر المتنقل</div>
        </div>
        <button onClick={handleLogout} style={{ background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: 20, padding: '7px 14px', color: 'white', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          خروج
        </button>
      </div>

      {/* محتوى التبويب */}
      {tab === 'sell' && <SellTab employee={employee} showToast={showToast} />}
      {tab === 'load' && <LoadTab employee={employee} showToast={showToast} />}
      {tab === 'settlement' && <SettlementTab employee={employee} />}

      {/* شريط تنقّل سفلي */}
      <div style={{ position: 'fixed', bottom: 0, right: 0, left: 0, maxWidth: 500, margin: '0 auto', background: 'white', borderTop: '1px solid #E2E8F0', display: 'flex', padding: '8px 0', boxShadow: '0 -2px 10px rgba(0,0,0,.06)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex: 1, background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 0' }}>
            <span style={{ fontSize: 20 }}>{t.icon}</span>
            <span style={{ fontSize: 11, fontWeight: tab === t.id ? 900 : 600, color: tab === t.id ? '#EA580C' : '#94a3b8' }}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
