import type { Category } from '../types/catalog'

export type PresentedCategory = Category & { imageUrl: string }

const categoryImages: Record<string, string> = {
  酒水饮料: '/assets/categories/beverages.jpg',
  休闲零食: '/assets/categories/snacks.jpg',
  水果生鲜: '/assets/categories/fruit.jpg',
  洗涤清洁: '/assets/categories/household.jpg',
  卫生用品: '/assets/categories/dairy.jpg',
  米面粮油: '/assets/categories/grain-oil.jpg',
}

const fallbackImage = '/assets/categories/household.jpg'

export const presentCategories = (
  categories: Category[],
): PresentedCategory[] =>
  categories.map((category) => ({
    ...category,
    imageUrl: categoryImages[category.name] ?? fallbackImage,
  }))
