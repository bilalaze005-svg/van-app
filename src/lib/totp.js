/**
 * @file totp.js
 * @description تحقق ثنائي حقيقي (2FA) عبر TOTP — نفس المعيار المستخدم بتطبيقات
 * Google Authenticator / Microsoft Authenticator / Authy (RFC 6238).
 *
 * لا يحتاج أي خدمة خارجية (لا Resend، لا Meta، لا SMS) ولا إنترنت وقت توليد
 * الكود نفسه — تطبيق المصادقة على هاتف الموظف يولّد كوداً جديداً محلياً كل
 * 30 ثانية اعتماداً على "السر" المُولَّد مرة واحدة عند أول تسجيل دخول.
 *
 * السر يُحفظ بقاعدة البيانات (عمود totp_secret بجدول employees) — بما إن
 * المدير عنده وصول لقاعدة Supabase، يقدر يصفّره لأي موظف ضاع منه هاتفه
 * فيُطلب منه إعداد جديد بأول دخول تالٍ (راجع add_totp_column.sql).
 */
import { TOTP, Secret } from 'otpauth'

const ISSUER = 'نقاء'

// يولّد سراً عشوائياً جديداً (يُستخدم مرة واحدة فقط، أول تسجيل دخول)
export function generateSecret() {
  return new Secret({ size: 20 }).base32
}

// ينشئ كائن TOTP جاهز للتحقق أو لبناء رابط otpauth://
function buildTotp(secret, accountName) {
  return new TOTP({
    issuer: ISSUER,
    label: accountName,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secret),
  })
}

// رابط otpauth:// الجاهز لتوليد QR Code منه (يُمسح بتطبيق المصادقة)
export function getOtpAuthUrl(secret, accountName) {
  return buildTotp(secret, accountName).toString()
}

// يتحقق من الكود المُدخل — يسمح بفارق دقيقة واحدة قبل/بعد (تفاوت ساعة الجهاز)
export function verifyCode(secret, code) {
  const totp = buildTotp(secret, 'verify')
  const delta = totp.validate({ token: code.trim(), window: 2 })
  return delta !== null
}
