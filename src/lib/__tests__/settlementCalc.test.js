import { describe, it, expect } from 'vitest'
import { totalSales, salesByMode, vanStockValue } from '../settlementCalc.js'

describe('settlementCalc', () => {
  it('totalSales يجمع كل المبيعات بشكل صحيح', () => {
    const sales = [{ total: 100 }, { total: '250.5' }, { total: 0 }]
    expect(totalSales(sales)).toBe(350.5)
  })

  it('totalSales يرجع 0 لقائمة فارغة', () => {
    expect(totalSales([])).toBe(0)
  })

  it('salesByMode يجمّع حسب طريقة الدفع، ويفترض cash إن لم تُحدَّد', () => {
    const sales = [
      { total: 100, pay_mode: 'cash' },
      { total: 50, pay_mode: 'credit' },
      { total: 30 }, // بدون pay_mode → يُحسب كـ cash
    ]
    const result = salesByMode(sales)
    expect(result.cash).toBe(130)
    expect(result.credit).toBe(50)
  })

  it('vanStockValue يحسب القيمة التقديرية = كمية × سعر لكل صنف', () => {
    const stock = [{ qty: 2, price: 100 }, { qty: 3, price: 50 }]
    expect(vanStockValue(stock)).toBe(350)
  })
})
