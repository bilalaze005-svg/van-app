import { useState } from 'react'
import { T, cardStyle, buttonPrimary, buttonGhost, inputStyle } from '../lib/theme.js'
import {
  isBluetoothSupported, connectPrinter, disconnectPrinter, printReceipt, testReceiptData,
  getConnectedDevice, isConnected, getSavedPrinterWidth, setSavedPrinterWidth,
  getAutoPrint, setAutoPrint, getPrintCopies, setPrintCopies,
  getFooterText, setFooterText, getFontScale, setFontScale,
} from '../lib/printer.js'

export default function PrinterSettingsScreen({ onBack, showToast }) {
  const [device, setDevice] = useState(() => getConnectedDevice())
  const [connected, setConnected] = useState(() => isConnected())
  const [busy, setBusy] = useState(false)
  const [width, setWidth] = useState(() => getSavedPrinterWidth())
  const [fontScale, setFontScaleState] = useState(() => getFontScale())
  const [autoprint, setAutoprintState] = useState(() => getAutoPrint())
  const [copies, setCopiesState] = useState(() => getPrintCopies())
  const [footer, setFooterState] = useState(() => getFooterText())
  const supported = isBluetoothSupported()

  const handleChangePrinter = async () => {
    setBusy(true)
    try {
      const d = await connectPrinter()
      setDevice(d)
      setConnected(true)
      showToast(`✅ تم الاتصال بـ ${d.name || 'الطابعة'}`)
    } catch (e) {
      console.error('❌ خطأ اتصال الطابعة:', e)
      showToast('❌ ' + (e.message || 'فشل الاتصال بالطابعة'), true)
    } finally {
      setBusy(false)
    }
  }

  const handleDisconnect = async () => {
    setBusy(true)
    try {
      await disconnectPrinter()
      setDevice(null)
      setConnected(false)
      showToast('🔌 تم قطع الاتصال بالطابعة')
    } finally {
      setBusy(false)
    }
  }

  const handleTestPrint = async () => {
    setBusy(true)
    try {
      await printReceipt(testReceiptData())
      showToast('✅ أُرسلت فاتورة الاختبار — تحقق أن الطابعة طبعتها فعلياً')
    } catch (e) {
      console.error('❌ خطأ اختبار الطباعة:', e)
      showToast('❌ ' + (e.message || 'فشلت الطباعة'), true)
    } finally {
      setBusy(false)
    }
  }

  const handleWidthChange = (px) => { setWidth(px); setSavedPrinterWidth(px) }
  const handleFontScaleChange = (s) => { setFontScaleState(s); setFontScale(s) }
  const handleAutoprintToggle = () => { const n = !autoprint; setAutoprintState(n); setAutoPrint(n) }
  const handleCopiesChange = (delta) => { const n = Math.min(Math.max(copies + delta, 1), 5); setCopiesState(n); setPrintCopies(n) }
  const handleFooterChange = (e) => { setFooterState(e.target.value); setFooterText(e.target.value) }

  return (
    <div style={{ minHeight: '100vh', background: T.bg }}>
      {/* هيدر الشاشة */}
      <div style={{ background: 'white', padding: '18px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${T.border}`, position: 'sticky', top: 0, zIndex: 5 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: T.text }}>→</button>
        <div style={{ fontWeight: 900, fontSize: 15 }}>🖨️ إعدادات الطباعة</div>
        <div style={{ width: 20 }} />
      </div>

      <div style={{ padding: 16 }}>
        {!supported && (
          <div style={{ background: '#FEE2E2', color: T.danger, borderRadius: 12, padding: 12, fontSize: 12.5, marginBottom: 16, lineHeight: 1.6 }}>
            هذا المتصفح لا يدعم Web Bluetooth. الطباعة تعمل فقط على متصفح <b>Chrome</b> على أندرويد
            (أو داخل التطبيق المثبَّت مباشرة). إن كنت تفتح التطبيق من آيفون (Safari)، هذه الميزة لن تعمل إطلاقاً.
          </div>
        )}

        {supported && (
          <>
            {/* حالة الطابعة */}
            <div style={{ ...cardStyle, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12.5, color: T.textSoft, fontWeight: 700 }}>الطابعة</span>
                <span style={{
                  fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: T.radiusPill,
                  background: connected ? '#ECFDF5' : '#FEE2E2', color: connected ? T.success : T.danger,
                }}>
                  {connected ? '● متصلة' : '● غير متصلة'}
                </span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 14 }}>
                {device?.name || 'لا توجد طابعة محفوظة'}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleChangePrinter} disabled={busy}
                  style={{ ...buttonPrimary, flex: 1, padding: 12, fontSize: 12.5 }}>
                  {busy ? '⏳ ...' : '🔍 تغيير الطابعة'}
                </button>
                {connected && (
                  <button onClick={handleDisconnect} disabled={busy}
                    style={{ flex: 1, padding: 12, fontSize: 12.5, borderRadius: T.radiusMd, border: 'none', cursor: 'pointer', fontWeight: 800, fontFamily: 'inherit', background: '#FEE2E2', color: T.danger }}>
                    🔌 قطع الاتصال
                  </button>
                )}
              </div>

              <div style={{ fontSize: 11.5, color: T.textFaint, marginTop: 12, lineHeight: 1.7 }}>
                اضغط "تغيير الطابعة" واختر جهازك من القائمة التي يعرضها النظام. تأكد أن بلوتوث
                الهاتف مفعّل وأن الطابعة مُشغّلة وقريبة منك. الطابعة تُحفظ تلقائياً لمرات الاستخدام القادمة.
              </div>

              {connected && (
                <button onClick={handleTestPrint} disabled={busy}
                  style={{ ...buttonGhost, width: '100%', padding: 12, fontSize: 12.5, marginTop: 12 }}>
                  {busy ? '⏳ جارِ الطباعة...' : '🧾 اختبار الطباعة'}
                </button>
              )}
            </div>

            {/* حجم الورق */}
            <div style={{ ...cardStyle, marginBottom: 16 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 10 }}>حجم الورق</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ v: 576, l: 'Roll80' }, { v: 384, l: 'Roll58' }].map(w => (
                  <button key={w.v} onClick={() => handleWidthChange(w.v)}
                    style={{ flex: 1, padding: 12, borderRadius: T.radiusPill, border: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                      background: width === w.v ? T.success : T.bg, color: width === w.v ? 'white' : T.textSoft }}>
                    {w.l}
                  </button>
                ))}
              </div>
            </div>

            {/* حجم الخط */}
            <div style={{ ...cardStyle, marginBottom: 16 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 10 }}>حجم الخط</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ v: 1.2, l: 'صغير' }, { v: 1.55, l: 'متوسط' }, { v: 1.9, l: 'كبير' }].map(fs => (
                  <button key={fs.v} onClick={() => handleFontScaleChange(fs.v)}
                    style={{ flex: 1, padding: 12, borderRadius: T.radiusPill, border: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                      background: fontScale === fs.v ? T.success : T.bg, color: fontScale === fs.v ? 'white' : T.textSoft }}>
                    {fs.l}
                  </button>
                ))}
              </div>
            </div>

            {/* إعدادات إضافية */}
            <div style={{ ...cardStyle, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
                <span style={{ fontSize: 12.5, fontWeight: 700 }}>طباعة تلقائية بعد كل بيع</span>
                <button onClick={handleAutoprintToggle}
                  style={{ width: 44, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', position: 'relative',
                    background: autoprint ? T.primary : T.border }}>
                  <span style={{ position: 'absolute', top: 3, [autoprint ? 'right' : 'left']: 3, width: 20, height: 20, borderRadius: '50%', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: `1px solid ${T.border}` }}>
                <span style={{ fontSize: 12.5, fontWeight: 700 }}>عدد نسخ الفاتورة</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button onClick={() => handleCopiesChange(-1)} disabled={copies <= 1}
                    style={{ width: 28, height: 28, borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: 'white', cursor: 'pointer', fontWeight: 700, opacity: copies <= 1 ? 0.4 : 1 }}>−</button>
                  <span style={{ fontSize: 14, fontWeight: 900, minWidth: 16, textAlign: 'center' }}>{copies}</span>
                  <button onClick={() => handleCopiesChange(1)} disabled={copies >= 5}
                    style={{ width: 28, height: 28, borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: 'white', cursor: 'pointer', fontWeight: 700, opacity: copies >= 5 ? 0.4 : 1 }}>+</button>
                </div>
              </div>

              <div style={{ padding: '10px 0 2px', borderTop: `1px solid ${T.border}` }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, display: 'block', marginBottom: 6 }}>نص أسفل الفاتورة</span>
                <input value={footer} onChange={handleFooterChange} maxLength={60}
                  placeholder="شكراً لتعاملكم معنا" style={{ ...inputStyle, padding: 9, fontSize: 12.5 }} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
