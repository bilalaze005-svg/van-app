/**
 * Supabase client — النسخة المرجعية الموحَّدة لكل تطبيقات نقاء
 * (naqaa-shared/lib/supabase.js — راجع CHECKLIST.md قبل أي تعديل)
 *
 * الإعدادات في .env.local أو متغيرات بيئة Vercel:
 * VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
 *
 * ✅ لماذا هذه النسخة بالذات هي المرجعية: تجمع بين ميزتين كانتا
 * منفصلتين بنسختين مختلفتين قبل التوحيد —
 *   1) تحمّل رشيق (van-app): لو غابت متغيرات البيئة، لا ينهار التطبيق
 *      بخطأ فوري عند الاستيراد؛ بدلاً من ذلك stub آمن يُرجع خطأ واضحاً
 *      عند أول استخدام فعلي، فتظهر رسالة عربية مفهومة بدل شاشة بيضاء.
 *   2) ترويسة x-app-version (admin/driver/customer): تفيد لاحقاً عند
 *      تتبّع طلبات API حسب إصدار التطبيق المُرسِل بلوحة Supabase.
 */
import { createClient } from '@supabase/supabase-js'

const URL = import.meta.env.VITE_SUPABASE_URL
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const configError = (!URL || !KEY)
  ? '⚠️ إعدادات الاتصال ناقصة: أضف VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY بإعدادات Vercel (Environment Variables) ثم أعد النشر (Redeploy).'
  : null

if (configError) console.error(configError)

export const supabase = configError
  ? {
      from: () => ({ select: () => ({ order: () => Promise.resolve({ data: [], error: { message: configError } }) }) }),
      rpc: () => Promise.resolve({ data: null, error: { message: configError } }),
      auth: { signInWithPassword: () => Promise.resolve({ data: null, error: { message: configError } }) },
    }
  : createClient(URL, KEY, {
      auth: { autoRefreshToken: true, persistSession: true },
      global: { headers: { 'x-app-version': '4.1' } },
    })
