import axios from 'axios'
import { HttpResponse, delay, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { server } from '@/test/msw-server'
import { __resetRefreshState, installSessionInterceptors } from '@/shared/lib/session-interceptor'
import type { SessionPort } from '@/shared/lib/session-port'
import { queryClient } from '@/shared/lib/query-client'

const baseURL = 'http://test.local'

/**
 * Puerto falso en memoria — sin HTTP. Prueba que el interceptor funciona
 * contra CUALQUIER implementación de SessionPort, no solo el mock real del
 * repo. Es la prueba directa de que la abstracción cumple su propósito.
 */
function createFakePort(initialToken: string | null): SessionPort {
  let token = initialToken
  return {
    getAccessToken: () => token,
    isAuthenticated: () => token !== null,
    // No decodifica nada real — este puerto falso no necesita identidad
    // para probar el interceptor, solo tiene que cumplir la interfaz.
    getIdentityClaims: () => null,
    refresh: vi.fn(async () => {
      if (token === null) throw new Error('no session')
      token = 'fresh-token'
      return token
    }),
    signOut: vi.fn(() => {
      token = null
    }),
    subscribe: () => () => {},
  }
}

function createClient(port: SessionPort) {
  const client = axios.create({ baseURL })
  installSessionInterceptors(client, port)
  return client
}

beforeEach(() => {
  __resetRefreshState()
  queryClient.clear()
})

describe('installSessionInterceptors — request interceptor', () => {
  it('attaches Authorization: Bearer <accessToken> when a token is present', async () => {
    server.use(
      http.get(`${baseURL}/resource`, ({ request }) =>
        HttpResponse.json({ authHeader: request.headers.get('authorization') })
      )
    )
    const client = createClient(createFakePort('fresh-token'))

    const { data } = await client.get('/resource')

    expect(data.authHeader).toBe('Bearer fresh-token')
  })

  it('omits the Authorization header when there is no token', async () => {
    server.use(
      http.get(`${baseURL}/resource`, ({ request }) =>
        HttpResponse.json({ authHeader: request.headers.get('authorization') })
      )
    )
    const client = createClient(createFakePort(null))

    const { data } = await client.get('/resource')

    expect(data.authHeader).toBeNull()
  })

  it('omits the Authorization header and never retries on 401 when skipSessionAuth is set', async () => {
    const port = createFakePort('fresh-token')
    server.use(
      http.post(`${baseURL}/future-login`, ({ request }) =>
        HttpResponse.json({ authHeader: request.headers.get('authorization') }, { status: 401 })
      )
    )
    const client = createClient(port)

    await expect(
      client.post('/future-login', {}, { skipSessionAuth: true } as never)
    ).rejects.toMatchObject({ response: { status: 401 } })
    expect(port.refresh).not.toHaveBeenCalled()
  })
})

describe('installSessionInterceptors — 401 refresh-and-retry', () => {
  it('refreshes once and retries the original request on 401', async () => {
    let requestCount = 0
    server.use(
      http.get(`${baseURL}/resource`, ({ request }) => {
        requestCount += 1
        const auth = request.headers.get('authorization')
        if (auth === 'Bearer fresh-token') return HttpResponse.json({ ok: true })
        return new HttpResponse(null, { status: 401 })
      })
    )
    const port = createFakePort('expired')
    const client = createClient(port)

    const { data } = await client.get('/resource')

    expect(data).toEqual({ ok: true })
    expect(requestCount).toBe(2)
    expect(port.refresh).toHaveBeenCalledTimes(1)
  })

  it('issues exactly one refresh call when 5 requests 401 concurrently', async () => {
    server.use(
      http.get(`${baseURL}/resource`, ({ request }) => {
        const auth = request.headers.get('authorization')
        if (auth === 'Bearer fresh-token') return HttpResponse.json({ ok: true })
        return new HttpResponse(null, { status: 401 })
      })
    )
    const port = createFakePort('expired')
    const client = createClient(port)

    const results = await Promise.all(Array.from({ length: 5 }, () => client.get('/resource')))

    expect(port.refresh).toHaveBeenCalledTimes(1)
    for (const result of results) expect(result.data).toEqual({ ok: true })
  })

  it('leaves the request pending on real refresh latency, no synthetic resolution', async () => {
    server.use(
      http.get(`${baseURL}/resource`, ({ request }) => {
        const auth = request.headers.get('authorization')
        if (auth === 'Bearer fresh-token') return HttpResponse.json({ ok: true })
        return new HttpResponse(null, { status: 401 })
      })
    )
    const port = createFakePort('expired')
    let resolvedToken: string | null = 'expired'
    port.getAccessToken = () => resolvedToken
    port.refresh = vi.fn(async () => {
      await delay(30)
      resolvedToken = 'fresh-token'
      return 'fresh-token'
    })
    const client = createClient(port)

    let resolved = false
    const requestPromise = client.get('/resource').then((r) => {
      resolved = true
      return r
    })

    await new Promise((resolve) => setTimeout(resolve, 5))
    expect(resolved).toBe(false)

    await requestPromise
    expect(resolved).toBe(true)
  })
})

describe('installSessionInterceptors — refresh failure', () => {
  it('signs out and rejects with the original 401 when refresh fails', async () => {
    server.use(http.get(`${baseURL}/resource`, () => new HttpResponse(null, { status: 401 })))
    const port = createFakePort(null) // refresh() throws immediately: no session
    const client = createClient(port)

    await expect(client.get('/resource')).rejects.toMatchObject({
      response: { status: 401, config: { url: '/resource' } },
    })
    expect(port.signOut).toHaveBeenCalledTimes(1)
  })

  it('clears the shared query cache on forced sign-out', async () => {
    server.use(http.get(`${baseURL}/resource`, () => new HttpResponse(null, { status: 401 })))
    queryClient.setQueryData(['previous-user'], { name: 'old' })
    const port = createFakePort(null)
    const client = createClient(port)

    await expect(client.get('/resource')).rejects.toMatchObject({ response: { status: 401 } })
    expect(queryClient.getQueryData(['previous-user'])).toBeUndefined()
  })

  it('does not attempt a second refresh when the retried request 401s again', async () => {
    server.use(http.get(`${baseURL}/always-401`, () => new HttpResponse(null, { status: 401 })))
    const port = createFakePort('expired')
    const client = createClient(port)

    await expect(client.get('/always-401')).rejects.toMatchObject({
      response: { status: 401 },
    })
    expect(port.refresh).toHaveBeenCalledTimes(1)
  })
})
