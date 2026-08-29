import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from '@/test/msw-server'
import { __resetRefreshState } from '@/shared/lib/session-interceptor'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  __resetRefreshState()
})
afterAll(() => server.close())
