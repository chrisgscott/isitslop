import { checkRateLimit } from '@/lib/rate-limit'

describe('checkRateLimit', () => {
  it('allows first request', () => {
    const result = checkRateLimit('test-ip-' + Date.now())
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it('blocks after 5 requests', () => {
    const ip = 'test-ip-block-' + Date.now()
    for (let i = 0; i < 5; i++) {
      checkRateLimit(ip)
    }
    const result = checkRateLimit(ip)
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })
})
