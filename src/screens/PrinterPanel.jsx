import { useState } from 'react'
import { T, cardStyle, buttonPrimary, buttonGhost, inputStyle } from '../lib/theme.js'
import {
  isBluetoothSupported, connectPrinter, printReceipt, testReceiptData,
  getConnectedDevice, getSavedPrinterWidth, setSavedPrinterWidth,
  getAutoPrint, setAutoPrint, getPrintCopies, setPrintCopies,
  getFooterText, setFooterText,
} from '../lib/printer.js'

export default function PrinterPanel() {
  const [status, setStatus] = useState('idle') // idle | connecting | printing | error | success
  const [message, setMessage] = useState('')
  const [device, setDevice] = useState(() => getConnectedDevice())
  const [width, setWidth] = useState(() => getSavedPrinterWidth())
  const [autoprint, setAutoprintState] = useState(() => getAutoPrint())
  const [copies, setCopiesState] = useState(() => getPrintCopies())
  const [footer, setFooterState] = useState(() => getFooterText())
  const supported = isBluetoothSupported()

  const handleConnect = async () => {
    setStatus('connecting')
    setMessage('اختر طابعتك من القائمة التي سيعرضها المتصفح الآن...')
    try {
      const d = await connectPrinter()
      setDevice(d)
      setStatus('success')
      setMessage(`✅ تم الاتصال بـ ${d.name || 'الطابعة'}`)
    } catch (e) {
      console.error('❌ خطأ اتصال الطابعة:', e)
      setStatus('error')
      setMessage('❌ ' + (e.message || 'فشل الاتصال بالطابعة'))
    }
  }

  const handleTestPrint = async () => {
    setStatus('printing')
    setMessage('جارِ إرسال فاتورة تجريبية للطابعة...')
    try {
      await printReceipt(testReceiptData())
      setStatus('success')
      setMessage('✅ تم إرسال فاتورة الاختبار — تحقق أن الطابعة طبعتها فعلياً')
    } catch (e) {
      console.error('❌ خطأ اختبار الطباعة:', e)
      setStatus('error')
      setMessage('❌ ' + (e.message || 'فشلت الطباعة'))
    }
  }

  const handleWidthChange = (px) => {
    setWidth(px)
    setSavedPrinterWidth(px)
  }

  const handleAutoprintToggle = () => {
    const next = !autoprint
    setAutoprintState(next)
    setAutoPrint(next)
  }

  const handleCopiesChange = (delta) => {
    const next = Math.min(Math.max(copies + delta, 1), 5)
    setCopiesState(next)
    setPrintCopies(next)
  }

  const handleFooterChange = (e) => {
    setFooterState(e.target.value)
    setFooterText(e.target.value)
  }

  return (
    <div style={{ ...cardStyle, marginBottom: 16 }}>
      <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 10 }}>🖨️ الطابعة الحرارية (بلوتوث)</div>

      {!supported && (
        <div style={{ background: '#FEE2E2', color: T.danger, borderRadius: 12, padding: 12, fontSize: 12.5, marginBottom: 12, lineHeight: 1.6 }}>
          هذا المتصفح لا يدعم Web Bluetooth. الطباعة تعمل فقط على متصفح <b>Chrome</b> على أندرويد
          (أو Chrome/Edge على كمبيوتر). إن كنت تفتح التطبيق من آيفون (Safari)، هذه الميزة لن تعمل إطلاقاً —
          هذا قيد من آبل على كل المتصفحات، وليس خطأ بالتطبيق.
        </div>
      )}

      {supported && (
        <>
          <div style={{ fontSize: 12, color: T.textSoft, marginBottom: 10, lineHeight: 1.7 }}>
            عرض الورق:
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              {[{ v: 384, l: '58مم / 384 نقطة' }, { v: 576, l: '80مم / 576 نقطة' }].map(w => (
                <button key={w.v} onClick={() => handleWidthChange(w.v)}
                  style={{ flex: 1, padding: 8, borderRadius: T.radiusSm, border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                    background: width === w.v ? T.primary : T.bg, color: width === w.v ? 'white' : T.textSoft }}>
                  {w.l}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 6, opacity: 0.8 }}>
              إن خرجت الطباعة مقصوصة من الجانب أو صغيرة جداً بمنتصف الورقة، جرّب الخيار الآخر.
            </div>
          </div>

          {device && (
            <div style={{ background: '#ECFDF5', color: T.success, borderRadius: 12, padding: '8px 12px', fontSize: 12.5, marginBottom: 10, fontWeight: 700 }}>
              متصل حالياً بـ: {device.name || 'طابعة غير معروفة الاسم'}
            </div>
          )}

          {/* طباعة تلقائية بعد البيع */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderTop: `1px solid ${T.border}` }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text }}>🖨️ طباعة تلقائية بعد كل بيع</span>
            <button onClick={handleAutoprintToggle}
              style={{ width: 44, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', position: 'relative',
                background: autoprint ? T.primary : T.border, transition: 'background .15s' }}>
              <span style={{ position: 'absolute', top: 3, [autoprint ? 'right' : 'left']: 3, width: 20, height: 20, borderRadius: '50%', background: 'white', transition: 'all .15s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
            </button>
          </div>

          {/* عدد النسخ */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderTop: `1px solid ${T.border}` }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text }}>📄 عدد نسخ الفاتورة</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => handleCopiesChange(-1)} disabled={copies <= 1}
                style={{ width: 28, height: 28, borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: 'white', cursor: 'pointer', fontWeight: 700, opacity: copies <= 1 ? 0.4 : 1 }}>−</button>
              <span style={{ fontSize: 14, fontWeight: 900, minWidth: 16, textAlign: 'center' }}>{copies}</span>
              <button onClick={() => handleCopiesChange(1)} disabled={copies >= 5}
                style={{ width: 28, height: 28, borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: 'white', cursor: 'pointer', fontWeight: 700, opacity: copies >= 5 ? 0.4 : 1 }}>+</button>
            </div>
          </div>

          {/* نص مخصص أسفل الفاتورة */}
          <div style={{ padding: '8px 0', borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, marginBottom: 12 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text, display: 'block', marginBottom: 6 }}>✏️ نص أسفل الفاتورة</span>
            <input value={footer} onChange={handleFooterChange} maxLength={60}
              placeholder="شكراً لتعاملكم معنا"
              style={{ ...inputStyle, padding: 9, fontSize: 12.5 }} />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleConnect} disabled={status === 'connecting'}
              style={{ ...buttonGhost, flex: 1, padding: 12, fontSize: 12.5 }}>
              {status === 'connecting' ? '⏳ جارِ الاتصال...' : device ? '🔄 إعادة الاتصال' : '🔗 اتصال بالطابعة'}
            </button>
            <button onClick={handleTestPrint} disabled={status === 'printing'}
              style={{ ...buttonPrimary, flex: 1, padding: 12, fontSize: 12.5 }}>
              {status === 'printing' ? '⏳ جارِ الطباعة...' : '🧾 اختبار الطباعة'}
            </button>
          </div>

          {message && (
            <div style={{
              marginTop: 10, padding: '9px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600,
              background: status === 'error' ? '#FEE2E2' : status === 'success' ? '#ECFDF5' : T.bg,
              color: status === 'error' ? T.danger : status === 'success' ? T.success : T.textSoft,
            }}>
              {message}
            </div>
          )}
        </>
      )}
    </div>
  )
}
