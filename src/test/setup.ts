import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from '@/test/msw-server'
import { __resetRefreshState } from '@/shared/lib/session-interceptor'
import { __resetMemoryStorage } from '@/shared/mocks/storage'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  __resetRefreshState()
  __resetMemoryStorage()
})
afterAll(() => server.close())
