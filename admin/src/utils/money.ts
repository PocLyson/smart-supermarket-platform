export const centToYuan = (cent: number): string => (cent / 100).toFixed(2)

export const yuanToCent = (yuan: string): number => {
  if (!/^\d+(\.\d{1,2})?$/.test(yuan)) throw new Error('金额格式错误')
  return Math.round(Number(yuan) * 100)
}
