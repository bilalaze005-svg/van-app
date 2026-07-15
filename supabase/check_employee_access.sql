-- ============================================================
-- check_employee_access
-- تُستخدم للتحقق الدوري من أن الموظف ما زال مصرَّحًا له باستخدام
-- تطبيق الكاميو، دون الحاجة لكلمة المرور مرة أخرى (فقط رقم الموظف
-- المحفوظ محليًا بعد تسجيل الدخول).
--
-- التطبيق يستدعيها كل بضع دقائق ومتى ما يُفتح من جديد. لو رجعت
-- بأن الصلاحية أُلغيت، يسجّل التطبيق خروج الموظف تلقائيًا.
--
-- ⚠️ عدّل اسم الجدول (employees) وأسماء الأعمدة (id, permissions) إذا
-- كانت مختلفة لديك. يُفترض أنها نفس الأعمدة التي تُبنى منها نتيجة
-- verify_employee_login (emp_id / emp_permissions).
-- ============================================================

create or replace function public.check_employee_access(p_employee_id bigint)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_permissions jsonb;
begin
  select permissions into v_permissions
  from public.employees
  where id = p_employee_id;

  if v_permissions is null then
    -- الموظف غير موجود أصلاً (تم حذفه مثلاً)
    return '{}'::jsonb;
  end if;

  return v_permissions;
end;
$$;
