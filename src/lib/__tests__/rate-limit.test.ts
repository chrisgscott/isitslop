import { createRateLimiter, checkAnalyzeRateLimit, checkFlagRateLimit } from '@/lib/rate-limit'

describe('createRateLimiter', () => {
  it('allows first request', () => {
    const limiter = createRateLimiter({ maxRequests: 5, windowMs: 60000 })
    const result = limiter('test-ip-' + Date.now())
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it('blocks after maxRequests', () => {
    const limiter = createRateLimiter({ maxRequests: 5, windowMs: 60000 })
    const ip = 'test-ip-block-' + Date.now()
    for (let i = 0; i < 5; i++) {
      limiter(ip)
    }
    const result = limiter(ip)
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('separate limiters have independent pools', () => {
    const limiterA = createRateLimiter({ maxRequests: 2, windowMs: 60000 })
    const limiterB = createRateLimiter({ maxRequests: 2, windowMs: 60000 })
    const ip = 'test-ip-independent-' + Date.now()

    limiterA(ip)
    limiterA(ip)
    expect(limiterA(ip).allowed).toBe(false)
    expect(limiterB(ip).allowed).toBe(true)
  })
})

describe('pre-configured instances', () => {
  it('checkAnalyzeRateLimit is defined', () => {
    expect(typeof checkAnalyzeRateLimit).toBe('function')
  })

  it('checkFlagRateLimit is defined', () => {
    expect(typeof checkFlagRateLimit).toBe('function')
  })
})
