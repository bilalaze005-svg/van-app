import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { T, buttonPrimary, buttonGhost, inputStyle } from '../lib/theme.js'
import { generateSecret, getOtpAuthUrl, verifyCode } from '../lib/totp.js'
import TotpEnrollScreen from './TotpEnrollScreen.jsx'

export default function LoginScreen({ onLogin }) {
  const [step, setStep] = useState('credentials') // credentials | enroll | totp
  const [login, setLogin] = useState('')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const [pendingUser, setPendingUser] = useState(null)
  const [pendingSecret, setPendingSecret] = useState(null)
  const [code, setCode] = useState('')
  const [totpBusy, setTotpBusy] = useState(false)

  const submitCredentials = async () => {
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
      setPendingUser(sessionUser)

      const { data: row, error: fetchErr } = await supabase
        .from('employees')
        .select('totp_secret')
        .eq('user_id', emp.emp_id)
        .single()
      if (fetchErr) throw fetchErr

      if (row?.totp_secret) {
        setPendingSecret(row.totp_secret)
        setStep('totp')
      } else {
        const newSecret = generateSecret()
        setPendingSecret(newSecret)
        setStep('enroll')
      }
    } catch (e) {
      console.error('❌ خطأ تسجيل الدخول:', e)
      const detail = e?.message || e?.error_description || e?.hint || JSON.stringify(e)
      setErr('❌ ' + detail)
    } finally {
      setLoading(false)
    }
  }

  const onEnrollConfirmed = async () => {
    try {
      const { error } = await supabase
        .from('employees')
        .update({ totp_secret: pendingSecret })
        .eq('user_id', pendingUser.id)
      if (error) throw error
      localStorage.setItem('nq_van_employee', JSON.stringify(pendingUser))
      onLogin(pendingUser)
    } catch (e) {
      console.error('❌ خطأ حفظ سر التحقق:', e)
      const detail = e?.message || e?.error_description || e?.hint || JSON.stringify(e)
      setErr('❌ ' + detail)
      setStep('credentials')
    }
  }

  const submitOtp = () => {
    if (code.trim().length !== 6) { setErr('أدخل الكود المكوّن من 6 أرقام'); return }
    setTotpBusy(true)
    setErr('')
    const ok = verifyCode(pendingSecret, code)
    if (!ok) {
      setErr('❌ الكود غير صحيح — تأكد من الوقت بهاتفك وحاول مجدداً')
      setTotpBusy(false)
      return
    }
    localStorage.setItem('nq_van_employee', JSON.stringify(pendingUser))
    onLogin(pendingUser)
  }

  const backToCredentials = () => {
    setStep('credentials'); setErr(''); setCode(''); setPendingUser(null); setPendingSecret(null)
  }

  if (step === 'enroll') {
    return (
      <TotpEnrollScreen
        secret={pendingSecret}
        otpauthUrl={getOtpAuthUrl(pendingSecret, pendingUser.name)}
        accountName={pendingUser.name}
        onConfirmed={onEnrollConfirmed}
        onBack={backToCredentials}
      />
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 24, background: T.primaryGradient }}>
      <div style={{ background: 'white', borderRadius: 28, padding: 30, boxShadow: '0 20px 50px rgba(0,0,0,.2)' }}>
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <div style={{ width: 72, height: 72, borderRadius: 22, background: T.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, margin: '0 auto 14px' }}>
            {step === 'credentials' ? '🚚' : '🔐'}
          </div>
          <h1 style={{ fontSize: 19, fontWeight: 900, color: T.text }}>التاجر المتنقل</h1>
          <p style={{ fontSize: 12.5, color: T.textFaint, marginTop: 4 }}>
            {step === 'credentials' ? 'سجّل دخولك للمتابعة' : 'افتح تطبيق المصادقة على هاتفك وأدخل الكود الظاهر حالياً'}
          </p>
        </div>

        {step === 'credentials' && (
          <>
            <label style={{ fontSize: 12.5, fontWeight: 700, color: T.textSoft }}>البريد الإلكتروني أو اسم المستخدم</label>
            <input
              value={login} onChange={(e) => setLogin(e.target.value)}
              style={{ ...inputStyle, marginTop: 6, marginBottom: 14 }}
              placeholder="example@naqaa.com"
            />

            <label style={{ fontSize: 12.5, fontWeight: 700, color: T.textSoft }}>كلمة المرور</label>
            <input
              type="password" value={pass} onChange={(e) => setPass(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitCredentials()}
              style={{ ...inputStyle, marginTop: 6, marginBottom: 16 }}
              placeholder="••••••••"
            />

            {err && <div style={{ background: '#FEE2E2', color: T.danger, borderRadius: 12, padding: '11px 14px', fontSize: 13, marginBottom: 16, textAlign: 'center', fontWeight: 600 }}>{err}</div>}

            <button onClick={submitCredentials} disabled={loading}
              style={{ ...buttonPrimary, width: '100%', padding: 16, fontSize: 15.5, background: loading ? T.textFaint : T.primaryGradient, boxShadow: loading ? 'none' : buttonPrimary.boxShadow }}>
              {loading ? '⏳ جارِ الدخول...' : '🔑 دخول'}
            </button>
          </>
        )}

        {step === 'totp' && (
          <>
            <label style={{ fontSize: 12.5, fontWeight: 700, color: T.textSoft }}>رمز التحقق</label>
            <input
              autoFocus value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setErr('') }}
              onKeyDown={(e) => e.key === 'Enter' && !totpBusy && submitOtp()}
              inputMode="numeric" maxLength={6}
              style={{ ...inputStyle, marginTop: 6, marginBottom: 16, textAlign: 'center', fontSize: 22, letterSpacing: 8, fontWeight: 900 }}
              placeholder="••••••"
            />

            {err && <div style={{ background: '#FEE2E2', color: T.danger, borderRadius: 12, padding: '11px 14px', fontSize: 13, marginBottom: 16, textAlign: 'center', fontWeight: 600 }}>{err}</div>}

            <button onClick={submitOtp} disabled={totpBusy}
              style={{ ...buttonPrimary, width: '100%', padding: 16, fontSize: 15.5, marginBottom: 10, background: totpBusy ? T.textFaint : T.primaryGradient }}>
              {totpBusy ? '⏳ جارِ التحقق...' : '✅ تأكيد الدخول'}
            </button>
            <button onClick={backToCredentials} style={{ ...buttonGhost, width: '100%', padding: '8px 14px', fontSize: 12 }}>
              ← رجوع
            </button>
          </>
        )}
      </div>
    </div>
  )
}
