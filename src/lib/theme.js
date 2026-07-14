/**
 * @file theme.js
 * @description نظام تصميم موحّد لتطبيق "التاجر المتنقل" — ألوان، ظلال، وأنماط بطاقات
 * مشتركة تُستخدم عبر كل الشاشات، بدل تكرار قيم inline-style متفرّقة.
 */
export const T = {
  primary: '#EA580C',
  primaryDark: '#C2410C',
  primaryLight: '#FFF7ED',
  primaryGradient: 'linear-gradient(135deg,#F97316,#C2410C)',
  success: '#059669',
  danger: '#DC2626',
  text: '#0D1B2A',
  textSoft: '#64748B',
  textFaint: '#94A3B8',
  bg: '#F8FAFC',
  border: '#EEF1F5',
  card: {
    background: 'white',
    borderRadius: 20,
    boxShadow: '0 2px 16px rgba(15,23,42,.06)',
  },
  radiusSm: 12,
  radiusMd: 16,
  radiusLg: 20,
  radiusPill: 999,
}

export const cardStyle = { ...T.card, padding: 16 }

export const buttonPrimary = {
  background: T.primaryGradient,
  color: 'white',
  border: 'none',
  borderRadius: T.radiusMd,
  fontWeight: 800,
  fontFamily: 'inherit',
  cursor: 'pointer',
  boxShadow: '0 4px 14px rgba(234,88,12,.28)',
  transition: 'transform .12s ease, box-shadow .12s ease',
}

export const buttonGhost = {
  background: T.bg,
  color: T.textSoft,
  border: 'none',
  borderRadius: T.radiusMd,
  fontWeight: 700,
  fontFamily: 'inherit',
  cursor: 'pointer',
}

export const inputStyle = {
  width: '100%',
  padding: '13px 16px',
  borderRadius: T.radiusMd,
  border: `1.5px solid ${T.border}`,
  fontSize: 14,
  fontFamily: 'inherit',
  background: 'white',
  outline: 'none',
}
