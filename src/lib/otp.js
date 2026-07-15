/**
 * @file otp.js
 * @description منطق إرسال والتحقق من رمز التحقق الثنائي (OTP) عند تسجيل الدخول.
 *
 * ⚠️ الوضع الحالي: الكود ثابت دائماً "1234" ولا تُرسَل أي رسالة فعلية —
 * هذا فقط لتفعيل شاشة التحقق وتجربتها قبل ربط خدمة SMS حقيقية.
 *
 * لتفعيل رسائل SMS حقيقية لاحقاً:
 * 1. أنشئ حساباً لدى مزوّد SMS (لا يوجد مزوّد مجاني دائم — انظر ملاحظة الأسعار
 *    بالأسفل)
 * 2. أنشئ Supabase Edge Function تستقبل رقم الهاتف وترسل الطلب لواجهة برمجة
 *    المزوّد (API key يبقى على الخادم، لا يوضع مطلقاً في كود الواجهة الأمامية)
 * 3. استبدل محتوى الدالتين هنا لتناديا تلك الـ Edge Function بدل الكود الثابت
 *
 * ملاحظة حول "خدمة مجانية لرسائل SMS": لا يوجد مزوّد يرسل SMS فعلي مجاناً بلا
 * حدود — كل المزوّدين (Twilio وVonage وPlivo وغيرهم) يتقاضون عادة بين
 * 0.005 و0.08 دولار لكل رسالة حسب الدولة والحجم، وأغلبهم يمنحون فقط رصيداً
 * تجريبياً صغيراً عند التسجيل. البديل المجاني الحقيقي الوحيد هو استخدام تطبيق
 * مصادقة (TOTP) مثل Google Authenticator بدل الرسائل النصية — لا يحتاج إرسال
 * أي شيء عبر الشبكة، لكنه يتطلب أن يفتح الموظف تطبيق المصادقة كل مرة بدل تلقي
 * رسالة. أخبرني إن أردت اعتماد هذا البديل بدل SMS.
 */

const FIXED_CODE = '1234'
const OTP_TTL_MS = 5 * 60 * 1000 // صلاحية الرمز 5 دقائق

let pendingOtp = null // { login, expiresAt }

export async function sendOtp(login) {
  // TODO: استبدل هذا باستدعاء حقيقي لخدمة SMS عبر Supabase Edge Function
  pendingOtp = { login, expiresAt: Date.now() + OTP_TTL_MS }
  console.log(`📱 [تجريبي] رمز التحقق لـ ${login} هو: ${FIXED_CODE}`)
  return true
}

export function verifyOtp(login, code) {
  if (!pendingOtp || pendingOtp.login !== login) {
    return { ok: false, reason: 'لم يُطلَب رمز تحقق بعد — أعد المحاولة' }
  }
  if (Date.now() > pendingOtp.expiresAt) {
    return { ok: false, reason: 'انتهت صلاحية الرمز — اطلب رمزاً جديداً' }
  }
  if (code.trim() !== FIXED_CODE) {
    return { ok: false, reason: 'الرمز غير صحيح' }
  }
  pendingOtp = null
  return { ok: true }
}
