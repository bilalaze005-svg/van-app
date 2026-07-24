import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { T, buttonPrimary, buttonGhost, inputStyle } from '../lib/theme.js'
import { getOtpAuthUrl } from '../lib/totp.js'
import TotpEnrollScreen from './TotpEnrollScreen.jsx'

/**
 * @file LoginScreen.jsx
 * @description تسجيل دخول التاجر المتنقل بجلسة Supabase Auth حقيقية (aal2)،
 * بدل الاعتماد الكامل على مفتاح anon + RPC مخصص. نفس نمط naqaa-admin بالضبط:
 *   1) تحقق الهوية بـ verify_employee_login (كما كانت، بدون أي تغيير على
 *      تجربة الكتابة أو منطق الصلاحيات).
 *   2) جلسة Auth حقيقية (signInWithPassword)، وإن لم توجد بعد تُنشأ تلقائياً
 *      (signUp) بنفس كلمة المرور التي اجتازت التحقق للتو.
 *   3) MFA حقيقي من Supabase (auth.mfa.enroll/challenge/verify) — نفس واجهة
 *      QR القديمة (TotpEnrollScreen) لكن مربوطة بعامل TOTP حقيقي يرفع الجلسة
 *      فعلياً لـaal2، بدل تحقق محلي في المتصفح فقط.
 *
 * ⚠️ يتطلب من إعدادات Supabase (مرة واحدة، مشتركة مع باقي تطبيقات نقاء):
 *   Authentication → Providers → Email → إيقاف "Confirm email"
 */
export default function LoginScreen({ onLogin }) {
  // step: credentials | resync | enroll | totp
  const [step, setStep] = useState('credentials')
  const [login, setLogin] = useState('')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const [pendingUser, setPendingUser] = useState(null)
  const [pendingSecret, setPendingSecret] = useState(null) // سر جديد لعرض QR فقط (أول إعداد)
  const [pendingFactorId, setPendingFactorId] = useState(null)
  const [pendingRealEmail, setPendingRealEmail] = useState(null)
  const [pendingPass, setPendingPass] = useState(null)
  const [code, setCode] = useState('')
  const [totpBusy, setTotpBusy] = useState(false)

  // بعد نجاح aal1 (كلمة مرور صحيحة + جلسة Auth حقيقية): نتحقق هل عنده
  // عامل TOTP موثَّق مسبقاً أو يحتاج إعداد أول مرة
  const proceedToMfa = async (sessionUser) => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (error) throw error
      const verifiedTotp = (data?.totp || []).find(f => f.status === 'verified')

      if (verifiedTotp) {
        setPendingFactorId(verifiedTotp.id)
        setStep('totp')
      } else {
        const { data: enroll, error: enrollErr } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
          friendlyName: `naqaa-van-${sessionUser.id}`,
        })
        if (enrollErr) throw enrollErr
        setPendingFactorId(enroll.id)
        setPendingSecret(enroll.totp.secret)
        setStep('enroll')
      }
    } catch (e) {
      console.error('❌ خطأ تجهيز التحقق الثنائي:', e)
      setErr('تعذّر تجهيز التحقق الثنائي، حاول مجدداً')
    }
    setLoading(false)
  }

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

      const realEmail = emp.emp_email || (login.trim().includes('@') ? login.trim() : null)
      if (!realEmail) {
        setErr('حسابك بلا بريد إلكتروني مسجّل — لازم لتفعيل الدخول الآمن، تواصل مع الإدارة')
        setLoading(false)
        return
      }

      let { error: signInErr } = await supabase.auth.signInWithPassword({ email: realEmail, password: pass })

      if (signInErr) {
        const { error: signUpErr } = await supabase.auth.signUp({ email: realEmail, password: pass })

        if (!signUpErr) {
          const retry = await supabase.auth.signInWithPassword({ email: realEmail, password: pass })
          if (retry.error) throw retry.error
        } else if (signUpErr.message?.toLowerCase().includes('already') || signUpErr.status === 422) {
          // حساب Auth موجود أصلاً لكن كلمة المرور الحالية لا تطابقه —
          // نادر، يحتاج تدخل الإدارة (تصفير كلمة المرور من لوحة Supabase)
          setErr('⚠️ حسابك يحتاج إعادة ضبط من الإدارة — تواصل معهم لإعادة تفعيل الدخول')
          setLoading(false)
          return
        } else {
          console.error('❌ خطأ إنشاء حساب Auth حقيقي:', signUpErr)
          setErr('تعذّر إعداد جلسة آمنة — تأكد أن "Confirm email" مُعطَّل بإعدادات Supabase')
          setLoading(false)
          return
        }
      }

      await proceedToMfa(sessionUser)
    } catch (e) {
      console.error('❌ خطأ تسجيل الدخول:', e)
      const detail = e?.message || e?.error_description || e?.hint || JSON.stringify(e)
      setErr('❌ ' + detail)
      setLoading(false)
    }
  }

  // تأكيد أول إعداد TOTP (من TotpEnrollScreen) — يرجع true/false لعرض الخطأ هناك
  const onEnrollConfirmed = async (enteredCode) => {
    try {
      const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: pendingFactorId })
      if (challengeErr) throw challengeErr
      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId: pendingFactorId, challengeId: challenge.id, code: enteredCode,
      })
      if (verifyErr) return false
      localStorage.setItem('nq_van_employee', JSON.stringify(pendingUser))
      onLogin(pendingUser)
      return true
    } catch (e) {
      console.error('❌ خطأ حفظ التحقق الثنائي:', e)
      return false
    }
  }

  const submitOtp = async () => {
    if (code.trim().length !== 6) { setErr('أدخل الكود المكوّن من 6 أرقام'); return }
    setTotpBusy(true)
    setErr('')
    try {
      const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: pendingFactorId })
      if (challengeErr) throw challengeErr
      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId: pendingFactorId, challengeId: challenge.id, code: code.trim(),
      })
      if (verifyErr) {
        setErr('❌ الكود غير صحيح — تأكد من الوقت بهاتفك وحاول مجدداً')
        setTotpBusy(false)
        return
      }
      localStorage.setItem('nq_van_employee', JSON.stringify(pendingUser))
      onLogin(pendingUser)
    } catch (e) {
      console.error('❌ خطأ التحقق الثنائي:', e)
      setErr('خطأ في الاتصال، حاول مجدداً')
      setTotpBusy(false)
    }
  }

  const backToCredentials = () => {
    setStep('credentials'); setErr(''); setCode('')
    setPendingUser(null); setPendingSecret(null); setPendingFactorId(null)
    setPendingRealEmail(null); setPendingPass(null)
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
