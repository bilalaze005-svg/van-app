import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { T, buttonPrimary, inputStyle } from '../lib/theme.js'

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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 24, background: T.primaryGradient }}>
      <div style={{ background: 'white', borderRadius: 28, padding: 30, boxShadow: '0 20px 50px rgba(0,0,0,.2)' }}>
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <div style={{ width: 72, height: 72, borderRadius: 22, background: T.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, margin: '0 auto 14px' }}>🚚</div>
          <h1 style={{ fontSize: 19, fontWeight: 900, color: T.text }}>التاجر المتنقل</h1>
          <p style={{ fontSize: 12.5, color: T.textFaint, marginTop: 4 }}>سجّل دخولك للمتابعة</p>
        </div>

        <label style={{ fontSize: 12.5, fontWeight: 700, color: T.textSoft }}>البريد الإلكتروني أو اسم المستخدم</label>
        <input
          value={login} onChange={(e) => setLogin(e.target.value)}
          style={{ ...inputStyle, marginTop: 6, marginBottom: 14 }}
          placeholder="example@naqaa.com"
        />

        <label style={{ fontSize: 12.5, fontWeight: 700, color: T.textSoft }}>كلمة المرور</label>
        <input
          type="password" value={pass} onChange={(e) => setPass(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          style={{ ...inputStyle, marginTop: 6, marginBottom: 16 }}
          placeholder="••••••••"
        />

        {err && <div style={{ background: '#FEE2E2', color: T.danger, borderRadius: 12, padding: '11px 14px', fontSize: 13, marginBottom: 16, textAlign: 'center', fontWeight: 600 }}>{err}</div>}

        <button onClick={submit} disabled={loading}
          style={{ ...buttonPrimary, width: '100%', padding: 16, fontSize: 15.5, background: loading ? T.textFaint : T.primaryGradient, boxShadow: loading ? 'none' : buttonPrimary.boxShadow }}>
          {loading ? '⏳ جارِ الدخول...' : '🔑 دخول'}
        </button>
      </div>
    </div>
  )
}
