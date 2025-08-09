# Smart Monitoring System

## Overview

The Smart Monitoring System is an intelligent view tracking solution for Clippin that optimizes TikTok API usage by dynamically adjusting monitoring frequency based on video performance. Instead of checking all submissions at fixed intervals, the system classifies videos into performance-based tiers and monitors each tier at appropriate frequencies.

## Why Smart Monitoring?

**Traditional Problem**: Checking all submissions every 30 minutes results in:
- Excessive API calls (2 calls/hour per submission)
- Rate limiting issues with TikTok API
- Wasted resources on stable/declining videos
- Higher operational costs

**Smart Solution**: Dynamic tier-based monitoring provides:
- 60-90%+ reduction in API calls
- Responsive tracking for growing videos
- Efficient resource utilization
- Better rate limit management

## System Architecture

### 4-Tier Classification System

| Tier | Growth Rate | Monitoring Interval | Use Case |
|------|-------------|-------------------|----------|
| **HOT** | >100 views/hour | Every 15 minutes | Rapidly growing videos |
| **WARM** | 20-100 views/hour | Every 1 hour | Moderate growth |
| **COLD** | 5-20 views/hour | Every 6 hours | Slow growth |
| **ARCHIVED** | <5 views/hour | Every 24 hours | Stable/declining videos |

### Growth Rate Calculation

The system calculates growth rate using a 24-hour rolling window:

```typescript
growthRate = (currentViews - viewCount24HoursAgo) / hoursElapsed
```

**Algorithm Details:**
1. Maintain 7-day view history (max 168 data points)
2. Find closest data point to 24 hours ago
3. Calculate view delta over time elapsed
4. Handle edge cases (new videos, missing data)

### Hysteresis System

To prevent "tier flapping" (rapid tier changes), the system includes stability bonuses:
- **Hot tier**: +10 views/hour bonus when reclassifying
- **Warm tier**: +5 views/hour bonus when reclassifying
- **Cold/Archived**: No bonus (allows quick demotion)

This ensures videos don't rapidly switch between tiers due to minor fluctuations.

## Cron Job Integration

The system runs on a coordinated cron schedule:

```typescript
// Tier-specific monitoring
HOT tier: Every 15 minutes
WARM tier: Every 1 hour  
COLD tier: Every 6 hours
ARCHIVED tier: Every 24 hours

// Tier reclassification: Every 6 hours
// Ensures videos can move between tiers as performance changes
```

### Cron Job Functions

1. **`updateTierSubmissions`**: Updates view counts for specific tier
2. **`updateAllTierClassifications`**: Reclassifies all submissions based on current growth rates
3. **`cleanupOldRecords`**: Removes view tracking data older than 30 days

## Database Schema Additions

The system adds these fields to the `submissions` table:

```typescript
// Smart monitoring fields
monitoringTier: "hot" | "warm" | "cold" | "archived" | undefined
lastTierUpdate: number (timestamp)
growthRate: number (views per hour)
viewHistory: Array<{
  timestamp: number
  viewCount: number
}> // Last 7 days, max 168 points
```

### Database Indexes

Optimized queries using compound indexes:
- `by_tier_and_update`: `[monitoringTier, lastViewUpdate]`
- `by_monitoring_tier`: `[monitoringTier]`

## Performance & Efficiency

### API Call Reduction Calculation

**Smart Monitoring API Calls/Hour:**
- Hot: 4 calls/hour (every 15min)
- Warm: 1 call/hour (hourly)  
- Cold: 0.167 calls/hour (every 6h)
- Archived: 0.042 calls/hour (daily)

**Old System**: 2 calls/hour per submission (every 30min)

**Example with 100 submissions:**
- Old system: 200 API calls/hour
- Smart system (typical distribution): ~40 API calls/hour
- **80% reduction in API calls**

### Real-Time Efficiency Metrics

The system tracks performance in real-time:

```typescript
// Available via getMonitoringStats()
{
  tierCounts: { hot: 5, warm: 15, cold: 30, archived: 50 },
  totalApiCallsPerHour: 38.5,
  estimatedSavings: 80.75, // percentage
  rateLimitStatus: {
    requestsLastMinute: 2,
    utilizationPercent: 15.4,
    canMakeRequest: true
  }
}
```

## Implementation Details

### Tier Classification Algorithm

```typescript
function classifyTier(growthRate: number, currentTier?: MonitoringTier): MonitoringTier {
  // Apply hysteresis bonus to prevent flapping
  const hysteresisBonus = 
    currentTier === "hot" ? 10 : 
    currentTier === "warm" ? 5 : 0;
  
  const adjustedGrowthRate = growthRate + hysteresisBonus;

  if (adjustedGrowthRate >= 100) return "hot";
  if (adjustedGrowthRate >= 20) return "warm"; 
  if (adjustedGrowthRate >= 5) return "cold";
  return "archived";
}
```

### View History Management

- **Storage**: Rolling 7-day window in submission record
- **Size Limit**: Maximum 168 data points (hourly for 7 days)
- **Cleanup**: Automatic removal of data older than 7 days
- **Memory Efficient**: Array stored directly in submission document

### Rate Limiting Integration

The system coordinates with the global rate limiter:

```typescript
// Smart monitoring respects rate limits
if (!canMakeRequest) {
  // Skip this update cycle
  // Will be caught in next appropriate interval
}
```

## Admin Dashboard Integration

Administrators can monitor system performance through the admin dashboard:

### Available Metrics
- **Tier Distribution**: Count of submissions in each tier
- **API Efficiency**: Real-time API call savings percentage  
- **Rate Limit Status**: Current API usage and availability
- **Performance Trends**: Historical efficiency metrics

### Dashboard Components
- `SmartMonitoringStats.tsx`: Real-time monitoring statistics
- `AdminDashboard.tsx`: Administrative oversight interface

## Benefits Summary

### 🚀 Performance Benefits
- **60-90%+ API call reduction** vs fixed-interval monitoring
- **Responsive tracking** for high-growth content
- **Resource optimization** focusing on active videos

### 💰 Cost Savings  
- **Reduced API costs** through efficient usage
- **Lower infrastructure load** with targeted monitoring
- **Better rate limit utilization** preventing throttling

### 📊 Operational Benefits
- **Real-time visibility** into system efficiency
- **Automatic adaptation** to video performance patterns
- **Scalable architecture** that improves with more data

### ⚡ Technical Benefits
- **Intelligent caching** of stable video data
- **Predictive classification** based on growth patterns  
- **Robust error handling** with graceful degradation

## Monitoring & Maintenance

### Key Metrics to Monitor
1. **Tier distribution balance** (avoid too many hot tier videos)
2. **API call efficiency percentage** (target >70% savings)
3. **Rate limit utilization** (stay under 80%)
4. **Tier classification accuracy** (manual spot checks)

### Maintenance Tasks
- **Weekly**: Review tier distribution and efficiency metrics
- **Monthly**: Analyze growth rate threshold effectiveness
- **Quarterly**: Optimize tier boundaries based on usage patterns

### Troubleshooting
- **High API usage**: Check for too many videos in hot/warm tiers
- **Stale data**: Verify cron jobs are running correctly
- **Rate limiting**: Monitor tier distribution and adjust if needed
- **Missing tier classifications**: Check tier update cron job

## Migration & Rollback

### Enabling Smart Monitoring
1. Deploy smart monitoring code
2. Enable cron jobs in production
3. Monitor tier classifications (24-48 hours)
4. Disable legacy fallback once stable

### Rollback Plan
1. Re-enable legacy view tracking cron job
2. Disable smart monitoring cron jobs
3. Continue with existing monitoring system
4. Data remains intact for future re-enablement

---

*This system represents a significant evolution in TikTok view tracking efficiency, providing both performance improvements and cost optimization while maintaining data accuracy and responsiveness.*