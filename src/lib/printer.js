/**
 * @file printer.js
 * @description طباعة فاتورة على طابعة حرارية 80مم متصلة عبر Bluetooth، باستخدام
 * متصفح Chrome على أندرويد (Web Bluetooth API).
 *
 * ⚠️ قيود مهمة يجب معرفتها:
 * 1. Web Bluetooth يعمل فقط على Chrome/Edge (أندرويد أو كمبيوتر) — لا يعمل
 *    إطلاقاً على Safari/iOS. إن كان هاتف الموظف آيفون، هذه الميزة لن تظهر.
 * 2. أغلب طابعات الـ 80مم الرخيصة الشائعة (الصينية) تحتوي شريحة تدعم كلاً من
 *    Bluetooth Classic (SPP) و BLE في نفس الوقت — لكن Web Bluetooth يتحدث
 *    فقط مع BLE. لو كانت طابعتك قديمة جداً وتدعم SPP فقط، لن تظهر في قائمة
 *    الاقتران من داخل المتصفح (لكن ستظهر عادة في إعدادات بلوتوث النظام).
 * 3. نطبع الفاتورة كـ"صورة" وليس كنص، لضمان ظهور العربية بشكل صحيح دائماً —
 *    لأن أغلب هذه الطابعات لا تدعم خط عربي أو ترميز UTF-8 عند الطباعة كنص،
 *    لكنها كلها تدعم طباعة الصور بالأبيض والأسود (نقطة بنقطة).
 *
 * كيف تتحقق أنها تعمل فعلياً معك:
 * - افتح التطبيق على هاتف أندرويد بمتصفح Chrome (وليس تطبيق مثبّت من متجر آخر)
 * - فعّل بلوتوث الهاتف وشغّل الطابعة واتركها بجانب الهاتف
 * - اضغط "اختبار الطباعة" بالأسفل، اختر طابعتك من القائمة التي يعرضها المتصفح
 * - إن ظهرت رسالة خطأ، انسخها وأرسلها لي لأعرف بالضبط أين المشكلة
 */

import WebBluetoothReceiptPrinter from '@point-of-sale/webbluetooth-receipt-printer'
import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder'
import { Capacitor } from '@capacitor/core'
import { BleClient } from '@capacitor-community/bluetooth-le'

// هل نعمل داخل تطبيق أندرويد الأصلي (Capacitor) أم داخل متصفح عادي؟
// Web Bluetooth لا يعمل إطلاقاً داخل WebView تطبيق أندرويد، لذلك نستخدم
// مسارين مختلفين للاتصال بالطابعة حسب البيئة.
const IS_NATIVE = Capacitor.isNativePlatform()

// خدمة/خاصية شائعة جداً في طابعات الـ80مم الصينية الرخيصة عبر BLE.
// نجربها أولاً؛ ولو لم تكن موجودة، نبحث تلقائياً عن أي خاصية قابلة للكتابة.
const COMMON_PRINTER_SERVICE = '0000ff00-0000-1000-8000-00805f9b34fb'
const COMMON_PRINTER_WRITE_CHAR = '0000ff02-0000-1000-8000-00805f9b34fb'
const BLE_CHUNK_SIZE = 180 // حجم آمن لكل دفعة كتابة عبر BLE (حدود MTU الافتراضية)

let nativeDeviceId = null
let nativeWriteInfo = null // { serviceUUID, characteristicUUID }

const DEVICE_KEY = 'nq_van_printer_device'
const WIDTH_KEY = 'nq_van_printer_width'

let printerInstance = null
let connectedDevice = null

export function isBluetoothSupported() {
  if (IS_NATIVE) return true // على أندرويد الأصلي، BLE متاح دوماً عبر الإضافة
  return typeof navigator !== 'undefined' && !!navigator.bluetooth
}

export function getSavedPrinterWidth() {
  return parseInt(localStorage.getItem(WIDTH_KEY) || '384', 10)
}

export function setSavedPrinterWidth(px) {
  localStorage.setItem(WIDTH_KEY, String(px))
}

/**
 * يبحث بين كل خدمات الجهاز عن أول خاصية قابلة للكتابة (write أو
 * writeWithoutResponse)، متجاوزاً خدمات GATT القياسية العامة (معلومات
 * الجهاز، البطارية...) التي لا علاقة لها بالطباعة.
 */
function findWritableCharacteristic(services) {
  const ignoredServices = ['1800', '1801', '180a', '180f']
  for (const service of services) {
    const shortId = service.uuid.slice(4, 8).toLowerCase()
    if (ignoredServices.includes(shortId)) continue
    for (const char of service.characteristics || []) {
      if (char.properties?.write || char.properties?.writeWithoutResponse) {
        return { serviceUUID: service.uuid, characteristicUUID: char.uuid }
      }
    }
  }
  return null
}

async function connectNative() {
  await BleClient.initialize()
  // يفتح نافذة اختيار جهاز BLE من نظام أندرويد نفسه
  const device = await BleClient.requestDevice({ acceptAllDevices: true })
  await BleClient.connect(device.deviceId)
  nativeDeviceId = device.deviceId

  const services = await BleClient.getServices(device.deviceId)
  // نجرب أولاً الخدمة الشائعة، وإلا نبحث تلقائياً
  const commonMatch = services.find(s => s.uuid.toLowerCase() === COMMON_PRINTER_SERVICE)
  nativeWriteInfo = commonMatch
    ? { serviceUUID: COMMON_PRINTER_SERVICE, characteristicUUID: COMMON_PRINTER_WRITE_CHAR }
    : findWritableCharacteristic(services)

  if (!nativeWriteInfo) {
    throw new Error('لم يُعثر على خاصية كتابة صالحة بهذا الجهاز — قد لا تكون طابعة، أو تحتاج تهيئة يدوية')
  }

  connectedDevice = { id: device.deviceId, name: device.name || 'طابعة بلوتوث' }
  localStorage.setItem(DEVICE_KEY, JSON.stringify(connectedDevice))
  return connectedDevice
}

async function printNative(bytes) {
  if (!nativeDeviceId || !nativeWriteInfo) {
    throw new Error('لا يوجد اتصال بالطابعة بعد')
  }
  // نرسل البيانات على دفعات صغيرة لتفادي حدود MTU الافتراضية لـ BLE
  for (let i = 0; i < bytes.length; i += BLE_CHUNK_SIZE) {
    const chunk = bytes.slice(i, i + BLE_CHUNK_SIZE)
    const dataView = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength)
    await BleClient.writeWithoutResponse(
      nativeDeviceId, nativeWriteInfo.serviceUUID, nativeWriteInfo.characteristicUUID, dataView
    )
    // مهلة قصيرة بين الدفعات حتى لا تُغرق الطابعة الرخيصة ذات المخزن المؤقت الصغير
    await new Promise(r => setTimeout(r, 15))
  }
}

function getPrinter() {
  if (!printerInstance) {
    printerInstance = new WebBluetoothReceiptPrinter()
    printerInstance.addEventListener('connected', (device) => {
      connectedDevice = device
      localStorage.setItem(DEVICE_KEY, JSON.stringify({ id: device.id, name: device.name }))
    })
    printerInstance.addEventListener('disconnected', () => {
      connectedDevice = null
    })
  }
  return printerInstance
}

export function getConnectedDevice() {
  return connectedDevice
}

/**
 * يفتح نافذة اختيار جهاز بلوتوث من المتصفح (يجب استدعاؤها من onClick مباشرة،
 * وليس من داخل async منفصل بعد await، وإلا يرفضها المتصفح).
 */
export async function connectPrinter() {
  if (IS_NATIVE) {
    return connectNative()
  }
  if (!isBluetoothSupported()) {
    throw new Error('هذا المتصفح لا يدعم Web Bluetooth. جرّب Chrome على أندرويد.')
  }
  const printer = getPrinter()
  await printer.connect()
  // الحدث 'connected' يُطلَق داخلياً عبر setTimeout؛ ننتظر لحظة قصيرة
  // لضمان تحديث connectedDevice قبل استخدامه
  await new Promise(resolve => setTimeout(resolve, 50))
  if (!connectedDevice) {
    throw new Error('تعذّر الاتصال بالطابعة — تأكد أنها مُشغّلة وقريبة من الهاتف وحاول مجدداً')
  }
  return connectedDevice
}

/**
 * يرسم إيصال البيع على canvas (نص عربي RTL) ثم يحوّله لصورة نقطية—هذا يضمن
 * ظهور العربية بشكل صحيح بغض النظر عن دعم الطابعة للترميز العربي.
 */
function renderReceiptCanvas({ shopName, shopPhone, items, total, payMode, employeeName, date }, widthPx) {
  const padding = 10
  const lineHeight = 30
  const headerHeight = 110
  const footerHeight = 70
  const bodyHeight = items.length * lineHeight
  const rawHeight = headerHeight + bodyHeight + footerHeight
  // ‎.image() يشترط أن يكون الطول مضاعفاً للرقم 8
  const totalHeight = Math.ceil(rawHeight / 8) * 8

  const canvas = document.createElement('canvas')
  canvas.width = widthPx
  canvas.height = totalHeight
  const ctx = canvas.getContext('2d')

  // خلفية بيضاء
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#000'
  ctx.direction = 'rtl'
  ctx.textAlign = 'center'

  let y = 30
  ctx.font = 'bold 24px Arial'
  ctx.fillText('التاجر المتنقل — نقاء', widthPx / 2, y)
  y += 28

  ctx.font = '16px Arial'
  ctx.fillText(`الموظف: ${employeeName}`, widthPx / 2, y)
  y += 22
  ctx.fillText(date, widthPx / 2, y)
  y += 26

  ctx.textAlign = 'right'
  ctx.font = 'bold 18px Arial'
  ctx.fillText(`المحل: ${shopName}`, widthPx - padding, y)
  y += 22
  if (shopPhone) {
    ctx.font = '15px Arial'
    ctx.fillText(`الهاتف: ${shopPhone}`, widthPx - padding, y)
    y += 22
  }

  // خط فاصل
  ctx.beginPath()
  ctx.moveTo(padding, y)
  ctx.lineTo(widthPx - padding, y)
  ctx.lineWidth = 1
  ctx.stroke()
  y += 20

  ctx.font = '16px Arial'
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
  y += 26

  ctx.textAlign = 'center'
  ctx.font = 'bold 22px Arial'
  ctx.fillText(`الإجمالي: ${total.toFixed(0)} دج`, widthPx / 2, y)
  y += 26

  ctx.font = '15px Arial'
  const modeLabel = { cash: 'نقداً', credit: 'آجل', cheque: 'شيك', transfer: 'تحويل' }
  ctx.fillText(`طريقة الدفع: ${modeLabel[payMode] || payMode}`, widthPx / 2, y)
  y += 26

  ctx.font = '13px Arial'
  ctx.fillText('شكراً لتعاملكم معنا', widthPx / 2, y)

  return ctx.getImageData(0, 0, widthPx, totalHeight)
}

/**
 * يطبع فاتورة بيع حقيقية أو فاتورة اختبار.
 * @param {object} sale بيانات الفاتورة
 */
export async function printReceipt(sale) {
  if (!connectedDevice) {
    await connectPrinter()
  }

  const width = getSavedPrinterWidth()
  const imageData = renderReceiptCanvas(sale, width)

  const encoder = new ReceiptPrinterEncoder({
    language: connectedDevice?.language || 'esc-pos',
    codepageMapping: connectedDevice?.codepageMapping || 'epson',
  })

  const data = encoder
    .initialize()
    .align('center')
    .image(imageData, width, imageData.height, 'threshold')
    .newline()
    .newline()
    .cut()
    .encode()

  if (IS_NATIVE) {
    await printNative(data)
  } else {
    getPrinter().print(data)
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
