/**
 * @file notifications.js
 * @description جلب إشعارات الإدارة الموجّهة لهذا الموظف تحديداً (تطبيق الكاميو)
 * وتتبّع المقروء منها محلياً على الهاتف (بدون حاجة لجدول "مقروء" منفصل
 * بقاعدة البيانات — يكفي حفظ آخر إشعار شاهده الموظف في localStorage).
 *
 * ⚠️ الجدول الحقيقي (المُنشأ بلوحة الإدارة، راجع fix_notifications_schema.sql)
 * يخزّن صفاً منفصلاً لكل مستلم مع عمود target ('employee'|'driver'|'customer'|
 * 'admin') وعمود employee_id. لذا لازم نفلتر بالاثنين معاً، وإلا يرى الموظف
 * إشعارات موجّهة لعملاء/سائقين/إدارة أيضاً.
 */
import { supabase } from './supabase.js'

const LAST_SEEN_KEY_PREFIX = 'nq_van_notif_last_seen_id_'

export async function fetchNotifications(employeeId, limit = 30) {
  if (!employeeId) return []
  const { data, error } = await supabase
    .from('notifications')
    .select('id,title,body,created_at')
    .eq('target', 'employee')
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}

export function getLastSeenId(employeeId) {
  return parseInt(localStorage.getItem(LAST_SEEN_KEY_PREFIX + employeeId) || '0', 10)
}

export function markAllSeen(employeeId, latestId) {
  if (latestId) localStorage.setItem(LAST_SEEN_KEY_PREFIX + employeeId, String(latestId))
}

export function countUnread(employeeId, notifications) {
  const lastSeen = getLastSeenId(employeeId)
  return notifications.filter(n => n.id > lastSeen).length
}
