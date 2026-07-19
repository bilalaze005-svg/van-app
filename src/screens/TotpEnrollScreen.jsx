import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { T, buttonPrimary, buttonGhost, inputStyle } from '../lib/theme.js'
import { verifyCode } from '../lib/totp.js'

/**
 * @file TotpEnrollScreen.jsx
 * @description شاشة إعداد التحقق الثنائي لأول مرة: تعرض QR Code فوق (يُمسح
 * بتطبيق Google Authenticator أو أي تطبيق مصادقة مشابه) والكود النصي تحته
 * مع زر نسخ (لمن يفضّل الإدخال اليدوي). يجب إدخال الكود الحالي من التطبيق
 * للتأكيد قبل حفظ السر نهائياً — هذا يضمن أن الموظف أعدّ التطبيق بشكل صحيح
 * قبل ما يعتمد عليه بالدخول لاحقاً.
 */
export default function TotpEnrollScreen({ secret, otpauthUrl, accountName, onConfirmed, onBack }) {
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState(false)

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setErr('تعذّر النسخ — انسخه يدوياً من الخانة أعلاه')
    }
  }

  const confirm = () => {
    if (code.trim().length !== 6) { setErr('أدخل الكود المكوّن من 6 أرقام الظاهر بتطبيق المصادقة'); return }
    if (!verifyCode(secret, code)) { setErr('❌ الكود غير صحيح — تأكد من مسح QR الصحيح أو أعد المحاولة'); return }
    setErr('')
    onConfirmed()
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 24, background: T.primaryGradient }}>
      <div style={{ background: 'white', borderRadius: 28, padding: 28, boxShadow: '0 20px 50px rgba(0,0,0,.2)' }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ width: 60, height: 60, borderRadius: 18, background: T.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, margin: '0 auto 10px' }}>🔐</div>
          <h1 style={{ fontSize: 17, fontWeight: 900 }}>إعداد التحقق الثنائي</h1>
          <p style={{ fontSize: 12, color: T.textFaint, marginTop: 4, lineHeight: 1.6 }}>
            امسح الرمز بتطبيق <strong>Google Authenticator</strong> (أو أي تطبيق مصادقة مشابه)، مرة واحدة فقط
          </p>
        </div>

        {/* QR Code */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: 16, background: '#F8FAFC', borderRadius: 18, marginBottom: 14 }}>
          <QRCodeSVG value={otpauthUrl} size={190} level="M" />
        </div>

        {/* الكود النصي + زر نسخ */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: T.textSoft, marginBottom: 6 }}>
            أو أدخل هذا الكود يدوياً بتطبيق المصادقة:
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, background: '#F1F5F9', borderRadius: 12, padding: '11px 12px', fontFamily: 'monospace', fontSize: 14, letterSpacing: 1.5, wordBreak: 'break-all', fontWeight: 700, color: T.text }}>
              {secret}
            </div>
            <button onClick={copySecret}
              style={{ background: copied ? T.success : T.primary, color: 'white', border: 'none', borderRadius: 12, padding: '0 16px', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              {copied ? '✅ تم' : '📋 نسخ'}
            </button>
          </div>
        </div>

        <div style={{ height: 1, background: T.border, margin: '4px 0 16px' }} />

        {/* تأكيد الإعداد */}
        <label style={{ fontSize: 12.5, fontWeight: 700, color: T.textSoft }}>أدخل الكود الظاهر الآن بتطبيق المصادقة للتأكيد</label>
        <input
          value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setErr('') }}
          onKeyDown={(e) => e.key === 'Enter' && code.length === 6 && confirm()}
          inputMode="numeric" maxLength={6}
          style={{ ...inputStyle, marginTop: 6, marginBottom: 14, textAlign: 'center', fontSize: 22, letterSpacing: 8, fontWeight: 900 }}
          placeholder="••••••"
        />

        {err && <div style={{ background: '#FEE2E2', color: T.danger, borderRadius: 12, padding: '11px 14px', fontSize: 12.5, marginBottom: 14, textAlign: 'center', fontWeight: 600 }}>{err}</div>}

        <button onClick={confirm} disabled={code.length !== 6}
          style={{ ...buttonPrimary, width: '100%', padding: 16, fontSize: 15, marginBottom: 10, background: code.length !== 6 ? T.textFaint : T.primaryGradient }}>
          ✅ تأكيد وحفظ
        </button>
        <button onClick={onBack} style={{ ...buttonGhost, width: '100%', padding: 12, fontSize: 12.5 }}>
          ← رجوع
        </button>
      </div>
    </div>
  )
}
