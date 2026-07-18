/**
 * @file otp.js
 * @description طبقة التحقق بخطوتين (2FA) — تستعمل الآن Supabase Auth الحقيقي
 * لإرسال والتحقق من كود عبر البريد الإلكتروني، بعد إعداد SMTP مخصص (Resend)
 * بلوحة Supabase → Authentication → Email → SMTP Settings.
 *
 * ⚠️ ملاحظة مهمة: هذا لا يُنشئ "جلسة دخول" حقيقية بالتطبيق (الدخول الفعلي
 * يتم عبر verify_employee_login المخصصة، كما كان). نستخدم هنا آلية Supabase
 * Auth فقط كوسيلة توصيل وتحقق للكود — بمجرد التأكد من صحته، نخرج فوراً من
 * جلسة Supabase Auth (signOut) حتى لا تتعارض مع نظام الجلسات المخصص للتطبيق.
 *
 * كود Supabase Auth الحقيقي مكوّن من 6 أرقام (وليس 4 كما كان بوضع الاختبار).
 */
import { supabase } from './supabase.js'

// يرسل كود التحقق الحقيقي عبر البريد الإلكتروني
export async function sendOtp(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true }, // يسمح بإرسال الكود حتى لو أول مرة يستخدم هذا الإيميل مع Supabase Auth
  })
  if (error) return { ok: false, reason: error.message || 'تعذّر إرسال رمز التحقق' }
  return { ok: true }
}

// يتحقق من الكود المُدخل من الموظف — طلب شبكة حقيقي (لذا أصبحت async)
export async function verifyOtp(email, code) {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token: code.trim(),
    type: 'email',
  })
  if (error || !data?.session) {
    return { ok: false, reason: 'الرمز غير صحيح أو منتهي الصلاحية' }
  }
  // نخرج فوراً من جلسة Supabase Auth — لا نحتاجها، فقط أكّدت صحة الكود
  await supabase.auth.signOut()
  return { ok: true }
}

// يخفي جزء من عنوان البريد الإلكتروني لعرضه بأمان بالواجهة (مثال: bi••l@naqaa.com)
export function maskEmail(email) {
  if (!email) return ''
  const [user, domain] = email.split('@')
  if (!domain) return email
  const masked = user.length <= 2
    ? user[0] + '•'
    : user[0] + '•'.repeat(user.length - 2) + user.slice(-1)
  return masked + '@' + domain
}
