export const buildSearchUrl = (keyword: string): string => {
  const normalized = keyword.trim()
  return normalized
    ? `/pages/search/index?keyword=${encodeURIComponent(normalized)}`
    : '/pages/search/index'
}
