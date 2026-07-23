import { describe, it, expect } from 'vitest'
import { applyPromotions } from '../promotions.js'

describe('applyPromotions', () => {
  it('يرجّع نفس المجموع بدون أي عروض نشطة', () => {
    const items = [{ id: 1, price: 100, qty: 2 }]
    const result = applyPromotions(items, [])
    expect(result.subtotal).toBe(200)
    expect(result.promoDiscount).toBe(0)
    expect(result.netTotal).toBe(200)
  })

  it('يطبّق خصم نسبة مئوية (percent) على المنتجات المشمولة', () => {
    const items = [{ id: 1, price: 100, qty: 2 }]
    const promos = [{
      active: true, type: 'percent', discount_value: 10, min_amount: 0,
      product_ids: '[1]', name: 'خصم 10%',
    }]
    const result = applyPromotions(items, promos)
    expect(result.subtotal).toBe(200)
    expect(result.promoDiscount).toBe(20)
    expect(result.netTotal).toBe(180)
    expect(result.appliedPromoNames).toContain('خصم 10%')
  })

  it('لا يطبّق خصم percent إذا لم يبلغ الحد الأدنى (min_amount)', () => {
    const items = [{ id: 1, price: 50, qty: 1 }]
    const promos = [{ active: true, type: 'percent', discount_value: 10, min_amount: 100, product_ids: '[1]', name: 'خصم' }]
    const result = applyPromotions(items, promos)
    expect(result.promoDiscount).toBe(0)
  })

  it('يطبّق عرض bogo (اشترِ واحصل) بشكل صحيح', () => {
    // buy 2 get 1: كل 3 قطع، واحدة مجانية
    const items = [{ id: 5, price: 100, qty: 6 }]
    const promos = [{ active: true, type: 'bogo', tier_qty: 2, tier_value: 1, product_ids: '[5]', name: 'اشترِ 2 واحصل على 1' }]
    const result = applyPromotions(items, promos)
    // 6 قطع / مجموعة من 3 = مجموعتان → قطعتان مجانيتان
    expect(result.lines[0].freeQty).toBe(2)
    expect(result.lines[0].paidQty).toBe(4)
    expect(result.subtotal).toBe(400)
  })

  it('خصم tier_discount حسب العلامة التجارية (brand_ids)', () => {
    const items = [{ id: 1, price: 200, qty: 3, brand_id: 9 }]
    const promos = [{
      active: true, type: 'tier_discount', tier_qty: 2, tier_value: 15,
      tier_type: 'percent', brand_ids: '[9]', name: 'خصم كمية',
    }]
    const result = applyPromotions(items, promos)
    expect(result.promoDiscount).toBeCloseTo(90) // 15% من 600
  })

  it('لا يتجاوز الخصم الإجمالي المجموع الفرعي أبداً', () => {
    const items = [{ id: 1, price: 10, qty: 1 }]
    const promos = [{ active: true, type: 'fixed', discount_value: 999, min_amount: 0, product_ids: '[1]', name: 'خصم كبير' }]
    const result = applyPromotions(items, promos)
    expect(result.promoDiscount).toBe(10)
    expect(result.netTotal).toBe(0)
  })

  it('يتجاهل العروض المنتهية الصلاحية (end_date في الماضي)', () => {
    const items = [{ id: 1, price: 100, qty: 1 }]
    const promos = [{ active: true, type: 'percent', discount_value: 50, end_date: '2020-01-01', product_ids: '[1]', name: 'منتهي' }]
    const result = applyPromotions(items, promos)
    expect(result.promoDiscount).toBe(0)
  })
})
