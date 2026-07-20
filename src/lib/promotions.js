/**
 * @file promotions.js
 * @description حساب كل أنواع العروض النشطة (bogo, percent, fixed, tier_discount)
 * على عناصر سلة البيع — نفس المنطق المطبَّق بمتجر نقاء (naqaa-customer)، مُعمَّم
 * هنا ليقبل أي هيكل سلة طالما فيه {id, price, qty} لكل عنصر.
 *
 * راجع src/utils.js بمشروع naqaa-customer للشرح التفصيلي الكامل لكل نوع عرض.
 */
export function applyPromotions(items, promos = []) {
  const now = new Date()
  const activePromos = (promos || []).filter(p =>
    p.active && (!p.end_date || new Date(p.end_date) > now)
  )

  const bogoPromos = activePromos.filter(p =>
    p.type === 'bogo' && (parseInt(p.tier_qty) || 0) > 0 && (parseInt(p.tier_value) || 0) > 0
  )
  const valuePromos = activePromos.filter(p =>
    p.type === 'percent' || p.type === 'fixed' || p.type === 'tier_discount'
  )

  let savedAmount = 0
  const lines = items.map(item => {
    const price = Number(item.price) || 0
    const qty = Number(item.qty) || 1
    let freeQty = 0

    const promo = bogoPromos.find(p => {
      try {
        const ids = JSON.parse(p.product_ids || '[]').map(String)
        return ids.includes(String(item.id))
      } catch { return false }
    })

    if (promo) {
      const buyQty = parseInt(promo.tier_qty) || 1
      const getQty = parseInt(promo.tier_value) || 0
      const groupSize = buyQty + getQty
      if (groupSize > 0 && getQty > 0) {
        freeQty = Math.floor(qty / groupSize) * getQty
      }
    }

    const paidQty = qty - freeQty
    const lineTotal = paidQty * price
    savedAmount += freeQty * price

    return { ...item, freeQty, paidQty, lineTotal, unitPrice: price }
  })

  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0)

  let promoDiscount = 0
  const appliedPromoNames = []

  for (const promo of valuePromos) {
    let productIds = []
    try { productIds = JSON.parse(promo.product_ids || '[]').map(String) } catch { /* تجاهل */ }

    const qualifyingLines = productIds.length
      ? lines.filter(l => productIds.includes(String(l.id)))
      : lines

    if (!qualifyingLines.length) continue

    const qualifyingSubtotal = qualifyingLines.reduce((s, l) => s + l.lineTotal, 0)
    const qualifyingQty = qualifyingLines.reduce((s, l) => s + l.paidQty, 0)
    if (qualifyingSubtotal <= 0) continue

    let amt = 0

    if (promo.type === 'percent') {
      const minAmount = parseFloat(promo.min_amount) || 0
      if (qualifyingSubtotal < minAmount) continue
      amt = qualifyingSubtotal * (parseFloat(promo.discount_value) || 0) / 100
    } else if (promo.type === 'fixed') {
      const minAmount = parseFloat(promo.min_amount) || 0
      if (qualifyingSubtotal < minAmount) continue
      amt = Math.min(parseFloat(promo.discount_value) || 0, qualifyingSubtotal)
    } else if (promo.type === 'tier_discount') {
      const tierQty = parseInt(promo.tier_qty) || 0
      if (tierQty <= 0 || qualifyingQty < tierQty) continue
      const tierType = promo.tier_type === 'fixed' ? 'fixed' : 'percent'
      const tierValue = parseFloat(promo.tier_value) || 0
      amt = tierType === 'percent'
        ? qualifyingSubtotal * tierValue / 100
        : Math.min(tierValue, qualifyingSubtotal)
    }

    if (amt > 0) {
      promoDiscount += amt
      appliedPromoNames.push(promo.name)
    }
  }

  promoDiscount = Math.min(promoDiscount, subtotal)
  const netTotal = subtotal - promoDiscount

  return { lines, subtotal, savedAmount, promoDiscount, appliedPromoNames, netTotal }
}
