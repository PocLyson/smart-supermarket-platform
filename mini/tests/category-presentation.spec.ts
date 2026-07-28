import { describe, expect, it } from 'vitest'
import { presentCategories } from '../miniprogram/config/category-presentation'

describe('category presentation', () => {
  it('presents the six store categories in backend order with matching artwork', () => {
    const categories = [
      { id: 11, name: '酒水饮料', sortOrder: 10, enabled: true },
      { id: 12, name: '休闲零食', sortOrder: 20, enabled: true },
      { id: 13, name: '水果生鲜', sortOrder: 30, enabled: true },
      { id: 14, name: '洗涤清洁', sortOrder: 40, enabled: true },
      { id: 15, name: '卫生用品', sortOrder: 50, enabled: true },
      { id: 16, name: '米面粮油', sortOrder: 60, enabled: true },
    ]

    expect(presentCategories(categories)).toEqual([
      { ...categories[0], imageUrl: '/assets/categories/beverages.jpg' },
      { ...categories[1], imageUrl: '/assets/categories/snacks.jpg' },
      { ...categories[2], imageUrl: '/assets/categories/fruit.jpg' },
      { ...categories[3], imageUrl: '/assets/categories/household.jpg' },
      { ...categories[4], imageUrl: '/assets/categories/dairy.jpg' },
      { ...categories[5], imageUrl: '/assets/categories/grain-oil.jpg' },
    ])
  })

  it('uses a safe fallback image for a category added from the backend', () => {
    expect(
      presentCategories([
        { id: 99, name: '临时分类', sortOrder: 99, enabled: true },
      ]),
    ).toEqual([
      {
        id: 99,
        name: '临时分类',
        sortOrder: 99,
        enabled: true,
        imageUrl: '/assets/categories/household.jpg',
      },
    ])
  })
})
