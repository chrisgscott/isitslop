interface RateLimitConfig {
  maxRequests: number
  windowMs: number
}

export function createRateLimiter({ maxRequests, windowMs }: RateLimitConfig) {
  const requests = new Map<string, { count: number; resetAt: number }>()

  return function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
    const now = Date.now()
    const entry = requests.get(ip)

    if (!entry || now > entry.resetAt) {
      requests.set(ip, { count: 1, resetAt: now + windowMs })
      return { allowed: true, remaining: maxRequests - 1 }
    }

    if (entry.count >= maxRequests) {
      return { allowed: false, remaining: 0 }
    }

    entry.count++
    return { allowed: true, remaining: maxRequests - entry.count }
  }
}

// Pre-configured instances
export const checkAnalyzeRateLimit = createRateLimiter({ maxRequests: 20, windowMs: 60 * 60 * 1000 })
export const checkFlagRateLimit = createRateLimiter({ maxRequests: 10, windowMs: 60 * 60 * 1000 })
