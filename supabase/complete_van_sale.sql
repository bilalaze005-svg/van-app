-- ============================================================
-- complete_van_sale
-- دالة واحدة تنفّذ عملية البيع بالكامل (خصم كل الأصناف + تسجيل
-- الطلب) داخل معاملة واحدة (transaction) في PostgreSQL.
--
-- لماذا؟ الكود القديم في SellTab.jsx كان يستدعي sell_van_stock
-- لكل صنف على حدة داخل حلقة for من جهة العميل، ثم insert منفصل
-- لجدول orders. لو انقطع الاتصال أو فشل صنف في المنتصف، تُخصم
-- بعض المنتجات من مخزون الكاميو دون أن يُسجَّل الطلب أبداً —
-- وهذا فرق حقيقي في البضاعة يصعب تتبعه لاحقاً.
--
-- بما أن دالة plpgsql الواحدة تُنفَّذ داخل معاملة واحدة تلقائياً
-- في Postgres، فإن استدعاء sell_van_stock لكل صنف من *داخل* هذه
-- الدالة يجعل العملية كلها ذرّية: لو فشل صنف واحد (مثلاً نقص
-- بالمخزون)، تتراجع كل عمليات الخصم السابقة تلقائياً ولا يُنشأ
-- أي طلب.
--
-- طريقة التنفيذ: انسخ هذا الملف كاملاً في Supabase → SQL Editor
-- ثم اضغط Run. لا يحذف أو يعدّل أي دالة موجودة لديك.
-- ============================================================

create or replace function public.complete_van_sale(
  p_employee_id   bigint,
  p_items         jsonb,   -- [{ "product_id": 1, "name": "...", "price": 120, "qty": 3 }, ...]
  p_customer_name text,
  p_customer_phone text,
  p_pay_mode      text
) returns bigint
language plpgsql
security definer
as $$
declare
  v_item     jsonb;
  v_total    numeric := 0;
  v_order_id bigint;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'السلة فارغة';
  end if;

  if coalesce(trim(p_customer_name), '') = '' then
    raise exception 'اسم المحل مطلوب';
  end if;

  -- خصم كل صنف من مخزون الكاميو عبر دالتك الحالية sell_van_stock.
  -- لو رمت أي دالة استثناء (نقص كمية مثلاً)، تتراجع كل الحلقة تلقائياً.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    perform public.sell_van_stock(
      p_employee_id,
      (v_item->>'product_id')::bigint,
      (v_item->>'qty')::numeric
    );
    v_total := v_total + (v_item->>'price')::numeric * (v_item->>'qty')::numeric;
  end loop;

  insert into public.orders (
    customer_name, customer_phone, items, total, status, pay_mode,
    paid_amount, employee_id, confirmed_at, confirmed_by, created_at
  ) values (
    trim(p_customer_name),
    nullif(trim(p_customer_phone), ''),
    p_items::text,
    v_total,
    'delivered',
    p_pay_mode,
    case when p_pay_mode = 'credit' then 0 else v_total end,
    p_employee_id,
    now(),
    p_employee_id,
    now()
  ) returning id into v_order_id;

  return v_order_id;
end;
$$;

-- ملاحظة: إن كانت sell_van_stock تتحقق أصلاً من الكمية وترمي
-- استثناء عند النقص (وهذا مفترَض من كود SellTab.jsx الحالي)، فلا
-- حاجة لأي تعديل إضافي. تحقق فقط أن اسم الدالة والحقول (id, qty,
-- product_id) مطابقة لما لديك فعلياً في قاعدة بياناتك.
