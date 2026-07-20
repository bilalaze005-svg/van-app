/**
 * @file printer.js
 * @description طباعة فاتورة على طابعة حرارية 80مم متصلة عبر Bluetooth Low Energy (BLE).
 *
 * هذا الملف أُعيدت كتابته بالكامل لاستخدام أوامر ESC/POS الخام مباشرة، بدل
 * مكتبتَي @point-of-sale/webbluetooth-receipt-printer و
 * @point-of-sale/receipt-printer-encoder اللتين كانتا تسببان أخطاء
 * "Unknown codepage mapping" بسبب تضارب تسمية داخلي بين المكتبتين نفسهما.
 * هذه الطريقة (raster bitmap + أوامر ESC/POS يدوية) هي نفسها المُثبَتة نجاحها
 * فعلياً في مشروع "naqaa-confirm-app" الشقيق.
 *
 * قيود مهمة:
 * 1. الطابعة يجب أن تكون BLE. لو طابعتك Bluetooth Classic (SPP) فقط، هذا
 *    الجسر لن يتصل بها — يحتاج كود Android أصلي مختلف تمامًا.
 * 2. داخل تطبيق أندرويد (Capacitor)، نستخدم @capacitor-community/bluetooth-le.
 *    داخل متصفح عادي، نستخدم Web Bluetooth (navigator.bluetooth) مباشرة —
 *    ولا يعمل إطلاقاً داخل WebView تطبيق أندرويد ولا على iOS/Safari.
 * 3. النص العربي يُرسل كصورة (raster bitmap) لأن أغلب الطابعات الرخيصة لا
 *    تدعم ترميز UTF-8/العربي بجداولها الداخلية.
 */

import { Capacitor } from '@capacitor/core'
import { BleClient } from '@capacitor-community/bluetooth-le'

const IS_NATIVE = Capacitor.isNativePlatform()

const CANDIDATE_SERVICES = [
  { service: '000018f0-0000-1000-8000-00805f9b34fb', writeChar: '00002af1-0000-1000-8000-00805f9b34fb' },
  { service: '0000ffe0-0000-1000-8000-00805f9b34fb', writeChar: '0000ffe1-0000-1000-8000-00805f9b34fb' },
  { service: '0000ff00-0000-1000-8000-00805f9b34fb', writeChar: '0000ff02-0000-1000-8000-00805f9b34fb' },
]

const BLE_CHUNK_SIZE = 180

const DEVICE_KEY = 'nq_van_printer_device'
const WIDTH_KEY = 'nq_van_printer_width'
const AUTOPRINT_KEY = 'nq_van_printer_autoprint'
const COPIES_KEY = 'nq_van_printer_copies'
const FOOTER_KEY = 'nq_van_printer_footer'
const FONT_SCALE_KEY = 'nq_van_printer_font_scale'

let nativeInitialized = false
let deviceId = null
let matchedService = null
let connectedDevice = null
let browserGattChar = null
let browserDevice = null

export function isBluetoothSupported() {
  if (IS_NATIVE) return true
  return typeof navigator !== 'undefined' && !!navigator.bluetooth
}

export function getSavedPrinterWidth() {
  return parseInt(localStorage.getItem(WIDTH_KEY) || '384', 10)
}
export function setSavedPrinterWidth(px) {
  localStorage.setItem(WIDTH_KEY, String(px))
}

export function getAutoPrint() {
  return localStorage.getItem(AUTOPRINT_KEY) === '1'
}
export function setAutoPrint(enabled) {
  localStorage.setItem(AUTOPRINT_KEY, enabled ? '1' : '0')
}

export function getPrintCopies() {
  const n = parseInt(localStorage.getItem(COPIES_KEY) || '1', 10)
  return Math.min(Math.max(n, 1), 5)
}
export function setPrintCopies(n) {
  localStorage.setItem(COPIES_KEY, String(Math.min(Math.max(n, 1), 5)))
}

export function getFooterText() {
  return localStorage.getItem(FOOTER_KEY) || 'شكراً لتعاملكم معنا'
}
export function setFooterText(text) {
  localStorage.setItem(FOOTER_KEY, text || 'شكراً لتعاملكم معنا')
}

// مقياس حجم الخط: 0.85 صغير / 1 متوسط (افتراضي) / 1.2 كبير
export function getFontScale() {
  return parseFloat(localStorage.getItem(FONT_SCALE_KEY) || '1.55')
}
export function setFontScale(scale) {
  localStorage.setItem(FONT_SCALE_KEY, String(scale))
}

export function getConnectedDevice() {
  return connectedDevice
}

export function isConnected() {
  return !!deviceId && !!matchedService
}

function findMatchingService(services) {
  for (const candidate of CANDIDATE_SERVICES) {
    const svc = services.find(s => s.uuid.toLowerCase() === candidate.service.toLowerCase())
    const ch = svc?.characteristics?.find(c => c.uuid.toLowerCase() === candidate.writeChar.toLowerCase())
    if (ch && (ch.properties?.write || ch.properties?.writeWithoutResponse)) {
      return { ...candidate, useWriteWithoutResponse: !!ch.properties.writeWithoutResponse }
    }
  }
  const ignored = ['1800', '1801', '180a', '180f']
  for (const svc of services) {
    const shortId = svc.uuid.slice(4, 8).toLowerCase()
    if (ignored.includes(shortId)) continue
    for (const ch of svc.characteristics || []) {
      if (ch.properties?.write || ch.properties?.writeWithoutResponse) {
        return { service: svc.uuid, writeChar: ch.uuid, useWriteWithoutResponse: !!ch.properties.writeWithoutResponse }
      }
    }
  }
  return null
}

async function connectNative() {
  if (!nativeInitialized) {
    await BleClient.initialize({ androidNeverForLocation: true })
    nativeInitialized = true
  }
  const device = await BleClient.requestDevice({ optionalServices: CANDIDATE_SERVICES.map(c => c.service) })
  await BleClient.connect(device.deviceId, () => { deviceId = null; matchedService = null; connectedDevice = null })
  deviceId = device.deviceId

  // ✅ على أندرويد 13+، getServices() قد ترجع فاضية أحياناً إلا لو استُدعيت
  // discoverServices() أولاً (مشكلة معروفة بمكتبة @capacitor-community/bluetooth-le)
  try { await BleClient.discoverServices(device.deviceId) } catch { /* بعض الأجهزة لا تحتاجها */ }
  const services = await BleClient.getServices(device.deviceId)
  matchedService = findMatchingService(services)
  if (!matchedService) {
    await BleClient.disconnect(device.deviceId)
    deviceId = null
    throw new Error('تم الاتصال بالجهاز لكن لم يُعثر على خدمة طباعة معروفة — أرسل لي موديل طابعتك بالضبط لأضيف معرّفها')
  }

  connectedDevice = { name: device.name || 'طابعة بدون اسم' }
  localStorage.setItem(DEVICE_KEY, JSON.stringify(connectedDevice))
  return connectedDevice
}

async function connectBrowser() {
  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: CANDIDATE_SERVICES.map(c => c.service),
  })
  const server = await device.gatt.connect()

  for (const candidate of CANDIDATE_SERVICES) {
    try {
      const service = await server.getPrimaryService(candidate.service)
      const char = await service.getCharacteristic(candidate.writeChar)
      matchedService = { ...candidate, useWriteWithoutResponse: char.properties?.writeWithoutResponse }
      browserGattChar = char
      browserDevice = device
      deviceId = device.id
      connectedDevice = { name: device.name || 'طابعة بدون اسم' }
      localStorage.setItem(DEVICE_KEY, JSON.stringify(connectedDevice))
      device.addEventListener('gattserverdisconnected', () => {
        deviceId = null; matchedService = null; connectedDevice = null; browserGattChar = null
      })
      return connectedDevice
    } catch {
      // هذه الخدمة غير موجودة بهذا الجهاز، جرّب المرشّح التالي
    }
  }

  throw new Error('تم الاتصال بالجهاز لكن لم يُعثر على خدمة طباعة معروفة — أرسل لي موديل طابعتك بالضبط لأضيف معرّفها')
}

export async function connectPrinter() {
  if (IS_NATIVE) return connectNative()
  if (!isBluetoothSupported()) {
    throw new Error('هذا المتصفح لا يدعم Web Bluetooth. جرّب Chrome على أندرويد.')
  }
  return connectBrowser()
}

export async function disconnectPrinter() {
  try {
    if (IS_NATIVE && deviceId) {
      await BleClient.disconnect(deviceId)
    } else if (browserDevice?.gatt?.connected) {
      browserDevice.gatt.disconnect()
    }
  } finally {
    deviceId = null
    matchedService = null
    connectedDevice = null
    browserGattChar = null
    browserDevice = null
    localStorage.removeItem(DEVICE_KEY)
  }
}

async function writeBytes(bytes) {
  for (let i = 0; i < bytes.length; i += BLE_CHUNK_SIZE) {
    const chunk = bytes.slice(i, i + BLE_CHUNK_SIZE)
    const dataView = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength)
    if (IS_NATIVE) {
      if (matchedService.useWriteWithoutResponse) {
        await BleClient.writeWithoutResponse(deviceId, matchedService.service, matchedService.writeChar, dataView)
      } else {
        await BleClient.write(deviceId, matchedService.service, matchedService.writeChar, dataView)
      }
    } else {
      if (matchedService.useWriteWithoutResponse) {
        await browserGattChar.writeValueWithoutResponse(dataView)
      } else {
        await browserGattChar.writeValueWithResponse(dataView)
      }
    }
    await new Promise(r => setTimeout(r, 12))
  }
}

function renderReceiptCanvas({ shopName, shopPhone, items, total, payMode, employeeName, date, promoDiscount, appliedPromoNames }, widthPx) {
  const s = getFontScale() // 0.85 صغير / 1 متوسط / 1.2 كبير
  const f = (px) => Math.round(px * s) // يحسب حجم الخط الفعلي بعد المقياس

  const padding = 10
  const lineHeight = Math.round(30 * s)
  const headerHeight = Math.round(110 * s)
  const footerHeight = Math.round(70 * s)
  const bodyHeight = items.length * lineHeight
  const discountHeight = (promoDiscount > 0) ? Math.round(26 * s) : 0
  const totalHeight = headerHeight + bodyHeight + discountHeight + footerHeight

  const canvas = document.createElement('canvas')
  canvas.width = widthPx
  canvas.height = totalHeight
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#000'
  ctx.direction = 'rtl'
  ctx.textAlign = 'center'

  let y = Math.round(30 * s)
  ctx.font = `bold ${f(24)}px Arial`
  ctx.fillText('التاجر المتنقل — نقاء', widthPx / 2, y)
  y += Math.round(28 * s)

  ctx.font = `${f(16)}px Arial`
  ctx.fillText(`الموظف: ${employeeName}`, widthPx / 2, y)
  y += Math.round(22 * s)
  ctx.fillText(date, widthPx / 2, y)
  y += Math.round(26 * s)

  ctx.textAlign = 'right'
  ctx.font = `bold ${f(18)}px Arial`
  ctx.fillText(`المحل: ${shopName}`, widthPx - padding, y)
  y += Math.round(22 * s)
  if (shopPhone) {
    ctx.font = `${f(15)}px Arial`
    ctx.fillText(`الهاتف: ${shopPhone}`, widthPx - padding, y)
    y += Math.round(22 * s)
  }

  ctx.beginPath()
  ctx.moveTo(padding, y)
  ctx.lineTo(widthPx - padding, y)
  ctx.lineWidth = 1
  ctx.stroke()
  y += Math.round(20 * s)

  ctx.font = `${f(16)}px Arial`
  for (const it of items) {
    const lineTotal = (it.price * it.qty).toFixed(0)
    ctx.textAlign = 'right'
    ctx.fillText(`${it.name}`, widthPx - padding, y)
    ctx.textAlign = 'left'
    ctx.fillText(`${it.qty} × ${it.price} = ${lineTotal} دج`, padding, y)
    y += lineHeight
  }

  ctx.beginPath()
  ctx.moveTo(padding, y)
  ctx.lineTo(widthPx - padding, y)
  ctx.stroke()
  y += Math.round(26 * s)

  if (promoDiscount > 0) {
    ctx.textAlign = 'center'
    ctx.font = `${f(15)}px Arial`
    ctx.fillText(`🎯 خصم عروض (${(appliedPromoNames || []).join('، ')}): -${promoDiscount.toFixed(0)} دج`, widthPx / 2, y)
    y += Math.round(26 * s)
  }

  ctx.textAlign = 'center'
  ctx.font = `bold ${f(22)}px Arial`
  ctx.fillText(`الإجمالي: ${total.toFixed(0)} دج`, widthPx / 2, y)
  y += Math.round(26 * s)

  ctx.font = `${f(15)}px Arial`
  const modeLabel = { cash: 'نقداً', credit: 'آجل', cheque: 'شيك', transfer: 'تحويل' }
  ctx.fillText(`طريقة الدفع: ${modeLabel[payMode] || payMode}`, widthPx / 2, y)
  y += Math.round(26 * s)

  ctx.font = `${f(13)}px Arial`
  ctx.fillText(getFooterText(), widthPx / 2, y)

  return canvas
}

function canvasToEscposRaster(canvas) {
  const ctx = canvas.getContext('2d')
  const { width, height } = canvas
  const imgData = ctx.getImageData(0, 0, width, height).data
  const bytesPerRow = Math.ceil(width / 8)
  const raster = new Uint8Array(bytesPerRow * height)

  for (let yy = 0; yy < height; yy++) {
    for (let xx = 0; xx < width; xx++) {
      const idx = (yy * width + xx) * 4
      const gray = (imgData[idx] + imgData[idx + 1] + imgData[idx + 2]) / 3
      const isBlack = gray < 160
      if (isBlack) {
        raster[yy * bytesPerRow + (xx >> 3)] |= 0x80 >> (xx % 8)
      }
    }
  }

  const header = new Uint8Array([
    0x1d, 0x76, 0x30, 0x00,
    bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff,
    height & 0xff, (height >> 8) & 0xff,
  ])

  const out = new Uint8Array(header.length + raster.length)
  out.set(header, 0)
  out.set(raster, header.length)
  return out
}

async function printOnce(sale) {
  const width = getSavedPrinterWidth()
  const canvas = renderReceiptCanvas(sale, width)
  const raster = canvasToEscposRaster(canvas)
  const init = new Uint8Array([0x1b, 0x40])
  const feed = new Uint8Array([0x0a, 0x0a, 0x0a, 0x0a])
  await writeBytes(init)
  await writeBytes(raster)
  await writeBytes(feed)
}

export async function printReceipt(sale) {
  if (!isConnected()) {
    await connectPrinter()
  }
  const copies = getPrintCopies()
  for (let i = 0; i < copies; i++) {
    await printOnce(sale)
    if (i < copies - 1) await new Promise(r => setTimeout(r, 400))
  }
}

export function testReceiptData() {
  return {
    shopName: 'محل تجريبي — اختبار الطباعة',
    shopPhone: '0555 00 00 00',
    employeeName: 'اختبار',
    date: new Date().toLocaleString('ar-DZ'),
    items: [
      { name: 'منتج تجريبي 1', price: 120, qty: 2 },
      { name: 'منتج تجريبي 2', price: 350, qty: 1 },
    ],
    total: 120 * 2 + 350,
    payMode: 'cash',
  }
}
