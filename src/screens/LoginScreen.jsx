import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

export default function LoginScreen({ onLogin }) {
  const [login, setLogin] = useState('')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!login.trim() || !pass) { setErr('أدخل البريد/الاسم وكلمة المرور'); return }
    setErr('')
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('verify_employee_login', {
        p_login: login.trim(),
        p_password: pass,
      })
      if (error) throw error

      const emp = Array.isArray(data) ? data[0] : data
      if (!emp || !emp.emp_id) {
        setErr('البيانات غير صحيحة')
        setLoading(false)
        return
      }

      // ✅ تحقق من صلاحية الدخول لهذا التطبيق تحديداً (مضبوطة من لوحة الإدارة → الموظفون)
      let perms = {}
      if (emp.emp_permissions) {
        perms = typeof emp.emp_permissions === 'string' ? JSON.parse(emp.emp_permissions) : emp.emp_permissions
      }
      const hasAccess = (perms.vanApp || []).includes('view')
      if (!hasAccess) {
        setErr('حسابك ما عنده صلاحية الدخول لهذا التطبيق — تواصل مع الإدارة')
        setLoading(false)
        return
      }

      const sessionUser = { id: emp.emp_id, name: emp.emp_name }
      localStorage.setItem('nq_van_employee', JSON.stringify(sessionUser))
      onLogin(sessionUser)
    } catch (e) {
      console.error('❌ خطأ تسجيل الدخول:', e)
      setErr('حدث خطأ، حاول مجدداً')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 24, background: 'linear-gradient(160deg,#EA580C,#C2410C)' }}>
      <div style={{ background: 'white', borderRadius: 24, padding: 28, boxShadow: '0 10px 40px rgba(0,0,0,.25)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🚚</div>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: '#C2410C' }}>نقاء — مبيعات الكاميو</h1>
          <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>سجّل دخولك للمتابعة</p>
        </div>

        <label style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>البريد الإلكتروني أو اسم المستخدم</label>
        <input
          value={login} onChange={(e) => setLogin(e.target.value)}
          style={{ width: '100%', padding: 14, borderRadius: 12, border: '1.5px solid #E2E8F0', marginTop: 6, marginBottom: 16, fontSize: 15, fontFamily: 'inherit' }}
          placeholder="example@naqaa.com"
        />

        <label style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>كلمة المرور</label>
        <input
          type="password" value={pass} onChange={(e) => setPass(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          style={{ width: '100%', padding: 14, borderRadius: 12, border: '1.5px solid #E2E8F0', marginTop: 6, marginBottom: 16, fontSize: 15, fontFamily: 'inherit' }}
          placeholder="••••••••"
        />

        {err && <div style={{ background: '#FEE2E2', color: '#DC2626', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 16, textAlign: 'center' }}>{err}</div>}

        <button onClick={submit} disabled={loading}
          style={{ width: '100%', padding: 15, borderRadius: 14, border: 'none', background: loading ? '#FDBA74' : '#EA580C', color: 'white', fontWeight: 900, fontSize: 16, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit' }}>
          {loading ? '⏳ جارِ الدخول...' : '🔑 دخول'}
        </button>
      </div>
    </div>
  )
}
