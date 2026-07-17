-- ============================================================
-- notifications
-- جدول إشعارات عامة تُرسَل من الإدارة لكل موظفي تطبيق الكاميو.
-- الإدارة تضيف إشعاراً جديداً ببساطة عبر: Supabase -> Table Editor
-- -> notifications -> Insert row (title + body)، أو عبر استعلام SQL:
--
--   insert into notifications (title, body) values ('عنوان', 'نص الإشعار');
--
-- لا توجد لوحة إدارة مخصصة لإرسال الإشعارات بعد — هذا فقط الجزء الخاص
-- باستقبالها وعرضها داخل تطبيق الموظف.
-- ============================================================

create table if not exists public.notifications (
  id bigserial primary key,
  title text not null,
  body text,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

-- كل الموظفين (عبر anon key) يقدرون يقرؤون الإشعارات فقط، لا يعدّلون شيئاً
create policy "notifications_select_all" on public.notifications
  for select
  using (true);

-- ⚠️ لا نمنح صلاحية insert/update/delete لـ anon هنا عن قصد — إضافة
-- الإشعارات يجب أن تتم فقط من لوحة Supabase مباشرة (أو لاحقاً من لوحة
-- إدارة محمية بصلاحيات مختلفة)، وليس من تطبيق الموظف نفسه.
