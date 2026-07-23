// ============================================================
// src/hooks/useSettlement.js
// جلب مبيعات الفترة المختارة + مخزون الكاميو الحالي، لتبويب التسوية.
// ============================================================
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.js'
import { PERIODS } from '../lib/settlementCalc.js'

/**
 * @typedef {Object} SaleRow
 * @property {string} id
 * @property {string} customer_name
 * @property {number} total
 * @property {'cash'|'credit'|'cheque'|'transfer'} pay_mode
 * @property {string} created_at
 */

/**
 * @param {{employeeId: string, period: keyof typeof PERIODS}} args
 * @returns {Promise<{sales: SaleRow[], vanStock: import('./useVanSale.js').VanStockItem[]}>}
 */
async function fetchSettlement({ employeeId, period }) {
  const start = PERIODS[period].getStart()
  const [{ data: salesData, error: salesErr }, { data: stock, error: stockErr }] = await Promise.all([
    supabase.from('orders')
      .select('id,customer_name,total,pay_mode,created_at')
      .eq('employee_id', employeeId)
      .gte('created_at', start.toISOString())
      .order('created_at', { ascending: false }),
    supabase.rpc('get_van_stock', { p_employee_id: employeeId }),
  ])
  if (salesErr) throw salesErr
  if (stockErr) throw stockErr
  return { sales: salesData || [], vanStock: stock || [] }
}

export default function useSettlement({ employee, period }) {
  const query = useQuery({
    queryKey: ['settlement', employee.id, period],
    queryFn: () => fetchSettlement({ employeeId: employee.id, period }),
  })

  return {
    sales: query.data?.sales || [],
    vanStock: query.data?.vanStock || [],
    loading: query.isLoading,
    reload: query.refetch,
  }
}
