export const formatMoney = (cent: number): string => {
  const safeCent = Number.isFinite(cent) ? Math.round(cent) : 0
  const sign = safeCent < 0 ? '-' : ''
  const absolute = Math.abs(safeCent)
  const yuan = Math.floor(absolute / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const fraction = String(absolute % 100).padStart(2, '0')
  return `${sign}¥${yuan}.${fraction}`
}
