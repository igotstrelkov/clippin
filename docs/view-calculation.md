# View Calculation & Tracking System

## Overview

The Clippin platform uses a sophisticated view tracking system to monitor TikTok video performance and calculate creator earnings in real-time. The system fetches view counts from the TikTok API, applies rate limiting, and automatically calculates earnings based on CPM (Cost Per Mille) rates with comprehensive audit trails.

## System Architecture

### Core Components

| Component | Purpose | Technology |
|-----------|---------|------------|
| **TikTok API Integration** | Fetch real-time view counts | RapidAPI TikTok Scraper |
| **Rate Limiter** | Prevent API quota exhaustion | 120 requests/minute limit |
| **Smart Monitoring** | Tier-based update frequency | Hot/Warm/Cold/Archived tiers |
| **Earnings Calculator** | Convert views to creator payments | CPM-based formula |
| **Audit Trail** | Track all view changes | Complete transaction history |

## View Fetching Process

### TikTok API Integration

**API Service**: RapidAPI TikTok Scraper v7
- **Endpoint**: `https://tiktok-scraper7.p.rapidapi.com/`
- **Rate Limit**: 120 requests/minute (2 requests/second)
- **Response Data**: Complete video metadata including `play_count`

```typescript
// API Response Structure
{
  data: {
    play_count: number,      // Current view count
    digg_count: number,      // Likes
    comment_count: number,   // Comments  
    share_count: number,     // Shares
    author: {
      unique_id: string,     // TikTok username
      nickname: string       // Display name
    }
    // ... additional metadata
  }
}
```

### URL Pattern Support

**Supported TikTok URL Formats**:
- `https://www.tiktok.com/@username/video/1234567890`
- `https://tiktok.com/@username/video/1234567890`
- `https://vm.tiktok.com/shortcode`
- `https://www.tiktok.com/t/shortcode`

### Error Handling & Resilience

**Automatic Recovery**:
```typescript
// Rate limit handling
if (response.status === 429) {
  await wait(60000); // Wait 1 minute
  return retry();    // Single retry attempt
}

// Network error fallback  
catch (error) {
  logger.error("API call failed", { error });
  return 0; // Graceful degradation
}
```

## Rate Limiting System

### Dual-Layer Rate Limiting

**API Provider Limits (RapidAPI)**:
- 120 requests/minute (2 requests/second)
- Automatic retry on 429 status
- 60-second cooldown on rate limit hit

**Internal Rate Limiter**:
```typescript
RATE_LIMIT = {
  MAX_REQUESTS_PER_MINUTE: 120,
  MAX_REQUESTS_PER_SECOND: 2,
  WINDOW_SIZE_MS: 60000,    // 1 minute sliding window
  BURST_WINDOW_MS: 1000     // 1 second burst protection
}
```

### Request Queue Management

**Smart Queuing Logic**:
- Sliding window algorithm for precise rate limiting
- Burst protection prevents API overload
- Wait time calculation for optimal scheduling
- Request prioritization by monitoring tier

**Queue Monitoring**:
```typescript
// Real-time rate limit status
{
  canRequest: boolean,           // Can make request now
  waitTimeMs: number,           // Time to wait if blocked
  queueSize: number,            // Current queue size
  requestsLastMinute: number,   // Usage in last 60 seconds
  utilizationPercent: number    // % of rate limit used
}
```

## Earnings Calculation System

### CPM-Based Formula

**Earnings Calculation**:
```typescript
function calculateEarnings(viewCount, cpmRate, maxPayout) {
  // Convert CPM from cents to dollars
  const cpmInDollars = cpmRate / 100;
  
  // Calculate earnings: (views / 1000) * CPM
  const earningsInDollars = (viewCount / 1000) * cpmInDollars;
  
  // Convert back to cents for database storage
  const earningsInCents = Math.round(earningsInDollars * 100);
  
  // Apply maximum payout limit if set
  return maxPayout ? Math.min(earningsInCents, maxPayout) : earningsInCents;
}
```

### Example Calculation

**Scenario**: 50,000 views at €0.05 CPM with €200 max payout
```
CPM Rate: 5 cents (stored as 5)
View Count: 50,000
Max Payout: 20,000 cents (€200)

Calculation:
- CPM in dollars: 5 / 100 = 0.05
- Earnings: (50,000 / 1000) * 0.05 = €2.50
- In cents: 2.50 * 100 = 250 cents
- Final: min(250, 20000) = 250 cents = €2.50
```

### Budget Impact Calculation

**Campaign Budget Updates**:
```typescript
// When views increase, earnings increase, budget decreases
const earningsDelta = newEarnings - currentEarnings;
const newRemainingBudget = campaign.remainingBudget - earningsDelta;

// Auto-complete campaign if budget exhausted
if (newRemainingBudget <= 0) {
  campaign.status = "completed";
}
```

## Database Schema & Data Flow

### View Tracking Records

```typescript
viewTracking: {
  submissionId: Id<"submissions">,  // Links to submission
  viewCount: number,                // View count at this timestamp
  timestamp: number,                // When the data was recorded
  source: string,                   // "tiktok_api" | "manual_refresh" | "initial_fetch"
  metadata?: object                 // Additional tracking data
}
```

### Submission Updates

```typescript
submissions: {
  // ... existing fields
  viewCount: number,                // Current view count
  lastViewUpdate: number,           // Last time views were updated
  initialViewCount?: number,        // Views when first submitted
  thresholdMetAt?: number,          // When 1K views reached
  earnings?: number,                // Total earnings in cents
  paidOutAmount?: number,           // Amount already paid out
  lastApiCall?: number,             // Rate limiting timestamp
  viewHistory?: Array<{             // Smart monitoring history
    timestamp: number,
    viewCount: number
  }>
}
```

### Campaign Impact

```typescript
campaigns: {
  // ... existing fields
  totalViews?: number,              // Aggregate views across submissions
  remainingBudget: number,          // Budget minus paid earnings
  status: "active" | "completed"    // Auto-completed when budget exhausted
}
```

## Update Mechanisms

### 1. Automatic Monitoring (Smart Tiers)

**Tier-Based Frequencies**:
- **HOT**: Every 15 minutes (rapid growth videos)
- **WARM**: Every 1 hour (moderate growth)
- **COLD**: Every 6 hours (slow growth)
- **ARCHIVED**: Every 24 hours (stable/declining)

### 2. Manual Refresh

**User-Initiated Updates**:
```typescript
// Security & Rate Limiting
- Authentication required
- Access validation (creator or campaign brand)
- 5-minute cooldown between refreshes
- Single API call per refresh
```

### 3. Initial Submission Fetch

**New Submission Process**:
1. Submission created with `viewCount: 0`
2. Background job scheduled immediately
3. Initial view count fetched from TikTok API
4. Baseline established for growth tracking

## Real-Time Processing

### Atomic Database Updates

**Transaction-Safe Operations**:
```typescript
await Promise.all([
  // Update submission data
  db.patch(submissionId, {
    viewCount: newViews,
    earnings: newEarnings,
    lastViewUpdate: now
  }),
  
  // Update campaign data  
  db.patch(campaignId, {
    totalViews: campaign.totalViews + viewDelta,
    remainingBudget: newBudget
  }),
  
  // Update creator profile
  db.patch(profileId, {
    totalEarnings: profile.totalEarnings + earningsDelta
  })
]);
```

### View History Integration

**Smart Monitoring Data**:
- Async addition to `viewHistory` array
- 7-day rolling window (max 168 data points)
- Used for growth rate calculation
- Automatic cleanup of old data

## Threshold Management

### 1,000 View Milestone

**Automatic Threshold Detection**:
```typescript
// Trigger when crossing 1K views
if (previousViews < 1000 && newViewCount >= 1000) {
  await markThresholdMet(submissionId);
  // Triggers brand notification
  // Updates UI indicators
  // Logs milestone achievement
}
```

**Threshold Benefits**:
- Improved discoverability in campaign marketplace
- Eligibility for premium campaign features
- Enhanced creator profile metrics
- Automated brand notifications

## Security & Access Control

### Authentication Requirements

**All View Operations Require**:
- Valid user authentication
- Role-based access control
- Submission ownership verification
- Campaign brand authorization

### Access Control Matrix

| User Type | Own Submissions | Others' Submissions | Campaign Submissions |
|-----------|----------------|-------------------|-------------------|
| **Creator** | Full Access | No Access | No Access |
| **Brand** | No Access | No Access | Full Access (own campaigns) |
| **Admin** | Full Access | Full Access | Full Access |

### Rate Limiting Protection

**Anti-Abuse Measures**:
- 5-minute cooldown on manual refreshes
- API quota monitoring and alerts
- Suspicious activity detection
- Automatic throttling on abuse

## Error Handling & Recovery

### API Failure Recovery

**Graceful Degradation Strategy**:
```typescript
try {
  viewCount = await tiktokAPI.getViews(url);
} catch (error) {
  if (error.status === 429) {
    // Rate limit: wait and retry once
    await wait(60000);
    return retry();
  } else {
    // Network/API error: return 0, log error
    logger.error("TikTok API failed", { error });
    return 0;
  }
}
```

### Data Consistency

**Consistency Guarantees**:
- Atomic multi-table updates
- Transaction rollback on partial failures
- Audit trail preservation
- Manual reconciliation tools

### Monitoring & Alerts

**System Health Monitoring**:
- API success/failure rates
- Rate limit utilization
- View update frequency
- Earnings calculation accuracy

## Performance Optimization

### Caching Strategy

**View Count Caching**:
- No caching (real-time data priority)
- Rate limiting provides natural throttling
- Smart monitoring reduces unnecessary API calls
- Historical data cached in `viewTracking` table

### Database Optimization

**Query Optimization**:
- Indexed queries by submission ID and timestamp
- Efficient view history retrieval
- Optimized campaign aggregation queries
- Automatic cleanup of old tracking records

### API Efficiency

**Request Optimization**:
- Single API call per view update
- Batch processing not implemented (real-time priority)
- Smart tier monitoring reduces overall API usage
- Rate limiter prevents quota exhaustion

## Operational Procedures

### Daily Operations

**Routine Monitoring**:
1. Check API quota usage and success rates
2. Verify earnings calculations are accurate
3. Monitor view update frequencies by tier
4. Review failed API calls and error rates

### Troubleshooting Common Issues

**View Count Not Updating**:
1. Check submission's monitoring tier and last update
2. Verify TikTok URL is valid and accessible
3. Check rate limiter status and API quota
4. Review error logs for API failures

**Earnings Discrepancy**:
1. Verify CPM rate and max payout settings
2. Check view count history for accuracy
3. Validate earnings calculation formula
4. Review campaign budget and remaining balance

**API Rate Limiting**:
1. Monitor current queue size and utilization
2. Check for unusual traffic patterns
3. Verify rate limiter configuration
4. Consider tier redistributing for efficiency

## Future Enhancements

### Planned Improvements

**Enhanced Accuracy**:
- Multiple API source integration for redundancy
- View count validation and anomaly detection
- Historical trend analysis for fraud detection
- Real-time view velocity monitoring

**Performance Scaling**:
- Redis-based rate limiter for multi-instance deployments
- Batch API processing for efficiency gains
- Predictive caching based on view patterns
- Horizontal scaling support for high volume

**Advanced Features**:
- View count forecasting and projections
- Geographic view breakdown integration
- Engagement metrics beyond view counts
- Real-time creator earning dashboards

---

*This view calculation system provides accurate, real-time tracking of TikTok video performance with robust error handling, comprehensive audit trails, and automatic earnings calculation, forming the foundation of Clippin's performance-based creator compensation model.*