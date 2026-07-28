import { createServer } from 'node:http'

const categories = [
  { id: 1, name: '酒水饮料', enabled: true, sortOrder: 1 },
  { id: 2, name: '休闲零食', enabled: true, sortOrder: 2 },
  { id: 3, name: '水果生鲜', enabled: true, sortOrder: 3 },
  { id: 4, name: '洗涤清洁', enabled: true, sortOrder: 4 },
  { id: 5, name: '卫生用品', enabled: true, sortOrder: 5 },
  { id: 6, name: '米面粮油', enabled: true, sortOrder: 6 },
]

const products = [
  {
    id: 101,
    name: '每日鲜语鲜牛奶 950ml',
    categoryId: 1,
    priceCent: 1590,
    unit: '瓶',
    coverImageUrl: '/assets/categories/dairy.jpg',
    onShelf: true,
    description: '低温锁鲜，口感醇厚。冷藏保存，到店自取。',
    availableStock: 28,
  },
  {
    id: 102,
    name: '伊利安慕希原味酸奶',
    categoryId: 1,
    priceCent: 4990,
    unit: '箱',
    coverImageUrl: '/assets/categories/beverages.jpg',
    onShelf: true,
    description: '整箱家庭装，早餐与加餐都合适。',
    availableStock: 16,
  },
  {
    id: 201,
    name: '三只松鼠每日坚果 750g',
    categoryId: 2,
    priceCent: 6990,
    unit: '盒',
    coverImageUrl: '/assets/categories/snacks.jpg',
    onShelf: true,
    description: '多种坚果科学搭配，独立小包装。',
    availableStock: 20,
  },
  {
    id: 301,
    name: '鲁花压榨一级花生油 5L',
    categoryId: 6,
    priceCent: 11990,
    unit: '桶',
    coverImageUrl: '/assets/categories/grain-oil.jpg',
    onShelf: true,
    description: '浓香花生油，适合家庭日常烹饪。',
    availableStock: 12,
  },
  {
    id: 401,
    name: '青岛啤酒经典 500ml×12',
    categoryId: 1,
    priceCent: 5590,
    unit: '箱',
    coverImageUrl: '/assets/categories/beverages.jpg',
    onShelf: true,
    description: '经典醇爽口感，整箱到店自取。',
    availableStock: 9,
  },
  {
    id: 501,
    name: '正大鲜鸡蛋 30枚',
    categoryId: 3,
    priceCent: 3290,
    unit: '盒',
    coverImageUrl: '/assets/categories/meat-eggs.jpg',
    onShelf: true,
    description: '日期新鲜，家庭装更实惠。',
    availableStock: 24,
  },
]

const makeOrder = (orderNo, status, product = products[0]) => ({
  orderNo,
  status,
  paymentStatus: 'PAID',
  pickupName: '李女士',
  phone: '13800001234',
  totalCent: product.priceCent * 2,
  items: [
    {
      productId: product.id,
      productName: product.name,
      unitPriceCent: product.priceCent,
      quantity: 2,
      subtotalCent: product.priceCent * 2,
    },
  ],
  history: [{ status, createdAt: '2026-07-28T16:30:00' }],
  createdAt: '2026-07-28T16:30:00',
})

let orders = [
  makeOrder('LN202607280001', 'PENDING_CONFIRMATION'),
  makeOrder('LN202607280002', 'PREPARING', products[2]),
  makeOrder('LN202607280003', 'READY_FOR_PICKUP', products[3]),
  makeOrder('LN202607270004', 'COMPLETED', products[4]),
]

const reply = (response, data, statusCode = 200) => {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  })
  response.end(
    JSON.stringify({
      code: statusCode >= 200 && statusCode < 300 ? 'OK' : 'ERROR',
      message: statusCode >= 200 && statusCode < 300 ? 'ok' : 'not found',
      requestId: `visual-${Date.now()}`,
      data,
    }),
  )
}

createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost:8080')
  const path = url.pathname

  if (request.method === 'GET' && path === '/api/mini/categories') {
    reply(response, categories)
    return
  }

  if (request.method === 'GET' && path === '/api/mini/products') {
    const keyword = (url.searchParams.get('keyword') ?? '').trim().toLowerCase()
    const categoryId = Number(url.searchParams.get('categoryId') || 0)
    const filtered = products.filter(
      (product) =>
        (!categoryId || product.categoryId === categoryId) &&
        (!keyword || product.name.toLowerCase().includes(keyword)),
    )
    reply(response, {
      items: filtered,
      page: Number(url.searchParams.get('page') || 1),
      size: Number(url.searchParams.get('size') || 10),
      total: filtered.length,
    })
    return
  }

  const productMatch = path.match(/^\/api\/mini\/products\/(\d+)$/)
  if (request.method === 'GET' && productMatch) {
    const product = products.find((item) => item.id === Number(productMatch[1]))
    reply(response, product ?? null, product ? 200 : 404)
    return
  }

  if (request.method === 'POST' && path === '/api/mini/auth/wechat') {
    reply(response, {
      accessToken: 'visual-qa-token',
      profileComplete: true,
      expiresAt: Date.now() + 3_600_000,
    })
    return
  }

  if (path === '/api/mini/profile') {
    reply(response, { pickupName: '李女士', phone: '13800001234' })
    return
  }

  if (request.method === 'GET' && path === '/api/mini/orders') {
    reply(response, { items: orders, page: 1, size: 10, total: orders.length })
    return
  }

  if (request.method === 'POST' && path === '/api/mini/orders') {
    const created = makeOrder(`LN20260728${String(orders.length + 1).padStart(4, '0')}`, 'PENDING_CONFIRMATION')
    orders = [created, ...orders]
    reply(response, created)
    return
  }

  const cancelMatch = path.match(/^\/api\/mini\/orders\/([^/]+)\/cancel$/)
  if (request.method === 'POST' && cancelMatch) {
    const order = orders.find((item) => item.orderNo === decodeURIComponent(cancelMatch[1]))
    const cancelled = order ? { ...order, status: 'CANCELLED' } : null
    reply(response, cancelled, cancelled ? 200 : 404)
    return
  }

  const orderMatch = path.match(/^\/api\/mini\/orders\/([^/]+)$/)
  if (request.method === 'GET' && orderMatch) {
    const order = orders.find((item) => item.orderNo === decodeURIComponent(orderMatch[1]))
    reply(response, order ?? null, order ? 200 : 404)
    return
  }

  reply(response, null, 404)
}).listen(8080, '127.0.0.1', () => {
  console.log('visual fixture server listening on http://127.0.0.1:8080')
})
