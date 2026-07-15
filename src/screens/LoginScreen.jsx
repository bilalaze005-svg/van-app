import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { T, buttonPrimary, buttonGhost, inputStyle } from '../lib/theme.js'
import { sendOtp, verifyOtp } from '../lib/otp.js'

export default function LoginScreen({ onLogin }) {
  const [step, setStep] = useState('credentials') // credentials | otp
  const [login, setLogin] = useState('')
  const [pass, setPass] = useState('')
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [pendingUser, setPendingUser] = useState(null)
  const codeInputRef = useRef(null)

  useEffect(() => {
    if (step === 'otp') codeInputRef.current?.focus()
  }, [step])

  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

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

      // ✅ إرسال رمز التحقق الثنائي (حالياً كود ثابت 1234 للتجربة — انظر lib/otp.js)
      await sendOtp(login.trim())
      setResendCooldown(30)
      setStep('otp')
    } catch (e) {
      console.error('❌ خطأ تسجيل الدخول:', e)
      setErr('حدث خطأ، حاول مجدداً')
    } finally {
      setLoading(false)
    }
  }

  const submitOtp = () => {
    if (!code.trim()) { setErr('أدخل رمز التحقق'); return }
    const result = verifyOtp(login.trim(), code)
    if (!result.ok) { setErr(result.reason); return }

    setErr('')
    localStorage.setItem('nq_van_employee', JSON.stringify(pendingUser))
    onLogin(pendingUser)
  }

  const resendCode = async () => {
    if (resendCooldown > 0) return
    setErr('')
    await sendOtp(login.trim())
    setResendCooldown(30)
  }

  const backToCredentials = () => {
    setStep('credentials')
    setCode('')
    setErr('')
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
            {step === 'credentials' ? 'سجّل دخولك للمتابعة' : 'أدخل رمز التحقق المرسل لهاتفك'}
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

        {step === 'otp' && (
          <>
            <div style={{ background: T.primaryLight, borderRadius: 12, padding: '10px 14px', fontSize: 12, color: T.primaryDark, marginBottom: 16, textAlign: 'center', lineHeight: 1.6 }}>
              📱 وضع تجريبي: رمز التحقق الحالي دائماً هو <b>1234</b> (لا تُرسَل رسالة فعلية بعد)
            </div>

            <label style={{ fontSize: 12.5, fontWeight: 700, color: T.textSoft }}>رمز التحقق</label>
            <input
              ref={codeInputRef}
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
              onKeyDown={(e) => e.key === 'Enter' && submitOtp()}
              inputMode="numeric" maxLength={4}
              style={{ ...inputStyle, marginTop: 6, marginBottom: 16, textAlign: 'center', fontSize: 22, letterSpacing: 8, fontWeight: 900 }}
              placeholder="••••"
            />

            {err && <div style={{ background: '#FEE2E2', color: T.danger, borderRadius: 12, padding: '11px 14px', fontSize: 13, marginBottom: 16, textAlign: 'center', fontWeight: 600 }}>{err}</div>}

            <button onClick={submitOtp}
              style={{ ...buttonPrimary, width: '100%', padding: 16, fontSize: 15.5, marginBottom: 10 }}>
              ✅ تأكيد الدخول
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={backToCredentials} style={{ ...buttonGhost, padding: '8px 14px', fontSize: 12 }}>
                ← رجوع
              </button>
              <button onClick={resendCode} disabled={resendCooldown > 0}
                style={{ ...buttonGhost, padding: '8px 14px', fontSize: 12, opacity: resendCooldown > 0 ? 0.5 : 1 }}>
                {resendCooldown > 0 ? `إعادة الإرسال (${resendCooldown})` : 'إعادة إرسال الرمز'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
