package com.prodent.security;

import org.springframework.stereotype.Component;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicInteger;

@Component
public class RateLimiter {

    private final ConcurrentMap<String, WindowCounter> counters = new ConcurrentHashMap<>();

    public boolean isAllowed(String key, int maxRequests, int windowMinutes) {
        long windowMillis = windowMinutes * 60_000L;
        long now = System.currentTimeMillis();

        WindowCounter counter = counters.compute(key, (k, existing) -> {
            if (existing == null || now - existing.windowStart > windowMillis) {
                return new WindowCounter(now);
            }
            return existing;
        });

        return counter.count.incrementAndGet() <= maxRequests;
    }

    public void reset(String key) {
        counters.remove(key);
    }

    private static class WindowCounter {
        final long windowStart;
        final AtomicInteger count;

        WindowCounter(long windowStart) {
            this.windowStart = windowStart;
            this.count = new AtomicInteger(0);
        }
    }
}
