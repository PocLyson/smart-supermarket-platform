import { createHttpClient, NetworkUncertainError } from '../miniprogram/services/http'

describe('mini HTTP client', () => {
  it('omits undefined query values before sending a GET request', async () => {
    let sentData: unknown
    const client = createHttpClient({
      apiBaseUrl: () => 'https://api.test',
      showError: vi.fn(),
      onUnauthorized: vi.fn(),
      transport: (options) => {
        sentData = options.data
        options.success({
          statusCode: 200,
          data: {
            code: 'OK',
            message: '成功',
            requestId: 'request-query',
            data: [],
          },
        })
      },
    })

    await client.get('/api/mini/products', {
      categoryId: undefined,
      keyword: undefined,
      page: 1,
      size: 10,
    })

    expect(sentData).toStrictEqual({ page: 1, size: 10 })
  })

  it('rejects a malformed backend response instead of leaving the request pending', async () => {
    const showError = vi.fn()
    const client = createHttpClient({
      apiBaseUrl: () => 'https://api.test',
      showError,
      onUnauthorized: vi.fn(),
      transport: (options) => {
        options.success({ statusCode: 502, data: '<html>bad gateway</html>' })
      },
    })

    const request = client.get('/api/mini/products')
    await expect(request).rejects.toThrow('服务响应异常，请稍后重试')
    await expect(request).rejects.toBeInstanceOf(NetworkUncertainError)
    expect(showError).toHaveBeenCalledWith('服务响应异常，请稍后重试')
  })

  it('treats a valid 500 envelope as uncertain so an order key is retained', async () => {
    const client = createHttpClient({
      apiBaseUrl: () => 'https://api.test',
      showError: vi.fn(),
      onUnauthorized: vi.fn(),
      transport: (options) => {
        options.success({
          statusCode: 500,
          data: {
            code: 'INTERNAL_ERROR',
            message: '系统繁忙',
            requestId: 'request-500',
            data: null,
          },
        })
      },
    })

    await expect(client.post('/api/mini/orders')).rejects.toBeInstanceOf(
      NetworkUncertainError,
    )
  })

  it('clears the session on 401 and exposes the backend business message', async () => {
    const onUnauthorized = vi.fn()
    const client = createHttpClient({
      apiBaseUrl: () => 'https://api.test',
      showError: vi.fn(),
      onUnauthorized,
      transport: (options) => {
        options.success({
          statusCode: 401,
          data: {
            code: 'UNAUTHORIZED',
            message: '登录已过期',
            requestId: 'request-1',
            data: null,
          },
        })
      },
    })

    await expect(client.get('/api/mini/orders')).rejects.toThrow('登录已过期')
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('marks transport failure as a network-uncertain error', async () => {
    const client = createHttpClient({
      apiBaseUrl: () => 'https://api.test',
      showError: vi.fn(),
      onUnauthorized: vi.fn(),
      transport: (options) => options.fail(),
    })

    await expect(client.post('/api/mini/orders')).rejects.toBeInstanceOf(
      NetworkUncertainError,
    )
  })
})
