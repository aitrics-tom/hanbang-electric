/**
 * Rate Limiter - 요청 제한
 */

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

class RateLimiter {
  private requests = new Map<string, number[]>();

  check(
    identifier: string,
    config: RateLimitConfig = { maxRequests: 60, windowMs: 60000 }
  ): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const { maxRequests, windowMs } = config;

    const requests = this.requests.get(identifier) || [];

    // 윈도우 밖의 오래된 요청 제거
    const recentRequests = requests.filter((time) => now - time < windowMs);

    const remaining = Math.max(0, maxRequests - recentRequests.length);
    const resetAt = recentRequests.length > 0
      ? recentRequests[0] + windowMs
      : now + windowMs;

    if (recentRequests.length >= maxRequests) {
      return { allowed: false, remaining: 0, resetAt };
    }

    // 현재 요청 추가
    recentRequests.push(now);
    this.requests.set(identifier, recentRequests);

    // 메모리 정리 (1000개 이상의 IP 추적 시)
    if (this.requests.size > 1000) {
      this.cleanup(now, windowMs);
    }

    return { allowed: true, remaining: remaining - 1, resetAt };
  }

  private cleanup(now: number, windowMs: number) {
    for (const [key, requests] of this.requests.entries()) {
      const recent = requests.filter((time) => now - time < windowMs);
      if (recent.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, recent);
      }
    }
  }
}

export const rateLimiter = new RateLimiter();

export function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}
