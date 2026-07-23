// ============================================================
// src/hooks/useLoadStock.js
// منطق تبويب "تحميل": بحث بترقيم (infinite scroll) بالمنتجات، مخزون
// الكاميو الحالي، وعملية تحميل صنف من المخزون الرئيسي إلى الكاميو.
// ============================================================
import { useState, useEffect } from 'react'
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.js'

const PAGE_SIZE = 30

async function fetchProductsPage({ search, pageParam = 0 }) {
  let q = supabase.from('products').select('id,name,price,stock,sku,image').eq('disabled', false).gt('stock', 0)
  if (search.trim()) {
    const like = `%${search.trim()}%`
    q = q.or(`name.ilike.${like},sku.ilike.${like}`)
  }
  const from = pageParam * PAGE_SIZE
  const { data, error } = await q
    .order(search.trim() ? 'name' : 'created_at', { ascending: !!search.trim() })
    .range(from, from + PAGE_SIZE - 1)
  if (error) throw error
  return { items: data || [], nextPage: (data || []).length === PAGE_SIZE ? pageParam + 1 : undefined }
}

async function fetchVanStock(employeeId) {
  const { data, error } = await supabase.rpc('get_van_stock', { p_employee_id: employeeId })
  if (error) throw error
  return data || []
}

export default function useLoadStock({ employee, showToast, search }) {
  const queryClient = useQueryClient()
  const [loadingId, setLoadingId] = useState(null)

  // ✅ نفس مهلة الـ350ms الأصلية قبل البحث (queryKey في React Query يُطلق
  // طلباً فورياً عند تغيّره، فبدون هذا التأخير يصير طلب مع كل ضغطة حرف)
  const [debouncedSearch, setDebouncedSearch] = useState(search)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  // ✅ useInfiniteQuery — النمط الجاهز في React Query لأزرار "تحميل المزيد"،
  // بدل إدارة hasMore/loadingMore يدوياً بأنفسنا
  const productsQuery = useInfiniteQuery({
    queryKey: ['products-search', debouncedSearch.trim()],
    queryFn: ({ pageParam }) => fetchProductsPage({ search: debouncedSearch, pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
  })

  // ✅ نفس queryKey المستخدم في useVanSale.js — يشتركان بنفس النسخة
  // المخزَّنة مؤقتاً بدل جلبها مرتين لو فُتح التبويبان بنفس الجلسة
  const vanStockQuery = useQuery({
    queryKey: ['van-stock', employee.id],
    queryFn: () => fetchVanStock(employee.id),
    enabled: !!employee.id,
  })

  const products = (productsQuery.data?.pages || []).flatMap((p) => p.items)
  const vanStock = vanStockQuery.data || []

  const doLoad = async (product, qty) => {
    if (!qty || qty <= 0) { showToast('⚠️ أدخل كمية صحيحة أولاً', true); return false }
    if (qty > product.stock) { showToast(`⚠️ الكمية بالمخزون الرئيسي (${product.stock}) أقل من المطلوب`, true); return false }

    setLoadingId(product.id)
    try {
      const { error } = await supabase.rpc('load_van_stock', {
        p_employee_id: employee.id, p_product_id: product.id, p_qty: qty,
      })
      if (error) throw error
      showToast(`✅ تم تحميل ${qty} من ${product.name}`)
      // تحديث تفاؤلي فوري لعرض المخزون الرئيسي المتبقي، بدل انتظار إعادة جلب كاملة
      queryClient.setQueryData(['products-search', debouncedSearch.trim()], (old) => {
        if (!old) return old
        return {
          ...old,
          pages: old.pages.map((p) => ({
            ...p,
            items: p.items.map((it) => it.id === product.id ? { ...it, stock: it.stock - qty } : it),
          })),
        }
      })
      await vanStockQuery.refetch()
      return true
    } catch (e) {
      console.error('❌ خطأ التحميل:', e)
      showToast('❌ ' + (e.message || 'فشل التحميل'), true)
      return false
    } finally {
      setLoadingId(null)
    }
  }

  return {
    products,
    loadingList: productsQuery.isLoading,
    loadingMore: productsQuery.isFetchingNextPage,
    hasMore: !!productsQuery.hasNextPage,
    vanStock, loadingId,
    doLoad,
    loadMore: () => productsQuery.fetchNextPage(),
  }
}
