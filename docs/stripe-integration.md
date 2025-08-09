# Stripe Integration System

## Overview

The Clippin platform uses Stripe to power a sophisticated two-sided marketplace payment system. Brands fund campaigns upfront, the platform holds those funds, and creators receive payouts based on their video performance. The system leverages Stripe Connect for creator accounts and implements a robust transfer group architecture for financial tracking.

## System Architecture

### Two-Sided Marketplace Model

**Payment Flow:**
1. **Brand Payment** → Platform receives and holds funds
2. **Campaign Execution** → Creators submit content and earn based on views
3. **Creator Payout** → Platform transfers earned amounts to creators
4. **Platform Revenue** → Difference between campaign budget and creator payouts

### Core Components

| Component | Purpose | Stripe Service |
|-----------|---------|----------------|
| **Campaign Funding** | Brands pay for campaigns | Payment Intents |
| **Creator Accounts** | Individual payout destinations | Stripe Connect Express |
| **Creator Payouts** | Transfer earnings to creators | Transfers |
| **Transfer Groups** | Link related transactions | Transfer Groups |
| **Webhook Processing** | Real-time status updates | Webhook Events |

## Payment Models

### 1. Campaign Funding (Brand → Platform)

**Process:**
```typescript
// Brand initiates payment for campaign
PaymentIntent → Platform Account
- Amount: Campaign budget in EUR cents
- Transfer Group: Links future creator transfers
- Metadata: Campaign ID, brand ID, funding type
```

**Key Features:**
- **Immediate Capture**: Funds held in platform account
- **Transfer Group Creation**: Unique ID for linking future transfers
- **Campaign Activation**: Auto-activated on successful payment

### 2. Creator Payouts (Platform → Creator)

**Process:**
```typescript
// Platform transfers earned amounts to creators
Transfer → Creator Connect Account
- Source: Platform account funds
- Destination: Creator's Stripe Connect account
- Transfer Group: Links to original campaign charge
- Amount: Creator's earned views × CPM rate
```

**Key Features:**
- **Performance-Based**: Payouts calculated from TikTok view counts
- **Linked Transfers**: Connected to original campaign via transfer groups
- **Idempotency**: Prevents duplicate payouts with unique keys
- **Instant Processing**: Transfers complete within minutes

## Stripe Connect Integration

### Express Account Setup

**Creator Onboarding Flow:**
1. **Account Creation**: `stripe.accounts.create()` with Express type
2. **Onboarding Link**: Custom return URLs for seamless UX
3. **KYC Verification**: Stripe handles identity verification
4. **Account Status**: Real-time capability checking

```typescript
// Express account optimized for individual creators
{
  type: "express",
  capabilities: {
    card_payments: { requested: true },
    transfers: { requested: true }
  },
  business_type: "individual"
}
```

### Account Status Tracking

**Real-Time Capability Monitoring:**
- `details_submitted`: KYC information provided
- `charges_enabled`: Can receive payments
- `payouts_enabled`: Can withdraw to bank
- `requirements`: Outstanding verification needs

## Database Schema

### Payment Records Table

```typescript
payments: {
  userId: Id<"users">           // Creator or brand
  type: "campaign_payment" | "creator_payout"
  amount: number                // Amount in EUR cents
  stripePaymentIntentId?: string // For campaign payments
  stripeTransferId?: string     // For creator payouts
  status: "pending" | "completed" | "failed"
  campaignId?: Id<"campaigns">  // Links to campaign
  metadata: {
    submissionIds?: Id<"submissions">[]
    transferAmount?: number
    platformFee?: number
    stripeFee?: number
  }
  createdAt: number
}
```

### Campaign Enhancement

```typescript
campaigns: {
  // ... existing fields
  stripePaymentIntentId?: string    // Funding payment ID
  stripeTransferGroup?: string      // Links charges to transfers
  paymentStatus?: "pending" | "paid" | "failed"
  stripeFeeAmount?: number          // Stripe processing fees
}
```

### Profile Enhancement

```typescript
profiles: {
  // ... existing fields
  stripeCustomerId?: string         // For brands (future)
  stripeConnectAccountId?: string   // For creators
}
```

## Technical Implementation

### Transfer Groups Architecture

**Linking Strategy:**
```typescript
// Campaign payment creates transfer group
const transferGroup = `campaign_${campaignId}_${timestamp}`;

// All creator payouts use same transfer group
transfer_group: transferGroup  // Links to original charge
```

**Benefits:**
- **Accounting Clarity**: Easy reconciliation of related transactions
- **Compliance**: Audit trail for financial reporting
- **Dispute Resolution**: Clear transaction relationships

### Idempotency Implementation

**Duplicate Prevention:**
```typescript
// Unique key generation for creator payouts
const idempotencyKey = createHash("sha256")
  .update(`creator:${creatorId}|amount:${amount}|subs:${submissionIds.join(",")}`)
  .digest("hex");
```

**Protection Against:**
- Network retry failures
- User double-clicks
- System race conditions
- Webhook replay attacks

### Webhook Event Handling

**Critical Events Processed:**

| Event Type | Action | Purpose |
|------------|--------|---------|
| `payment_intent.succeeded` | Activate campaign | Campaign funding successful |
| `payment_intent.payment_failed` | Mark campaign failed | Payment declined/failed |
| `transfer.created` | Log payout initiated | Creator transfer started |
| `transfer.reversed` | Mark payout failed | Transfer was reversed |
| `account.updated` | Update creator status | Connect account changes |
| `balance.available` | Process pending payouts | Funds available for transfers |

### Error Handling & Recovery

**Payment Failures:**
```typescript
// Comprehensive error handling
try {
  const transfer = await stripe.transfers.create(transferData);
  // Record success
} catch (error) {
  // Create failed payment record
  // Log error details
  // Notify creator of failure
  // Queue for manual review
}
```

**Recovery Mechanisms:**
- **Failed Payment Records**: Track all attempts
- **Manual Retry Logic**: Admin can reprocess failed transfers
- **Webhook Reconciliation**: Cross-check with Stripe events
- **Balance Monitoring**: Ensure sufficient funds before transfers

## Frontend Integration

### Campaign Payment Component

**Brand Payment Flow:**
```typescript
// CampaignPayment.tsx
- Stripe Elements integration
- Payment Intent creation
- Real-time status updates
- Campaign activation on success
```

### Creator Onboarding Component

**Stripe Connect Setup:**
```typescript
// StripeConnectOnboarding.tsx
- Account status checking
- Onboarding link generation
- Progress tracking
- Verification status display
```

### Payout Management

**Creator Dashboard:**
```typescript
// PayoutRequestModal.tsx
- Pending earnings calculation
- Payout request initiation
- Transfer status tracking
- Payment history display
```

## Security & Compliance

### PCI Compliance

**Data Protection:**
- **No Card Storage**: Stripe Elements handles sensitive data
- **Webhook Verification**: Cryptographic signature validation
- **HTTPS Only**: All API calls over secure connections
- **Environment Separation**: Different keys for dev/prod

### Financial Controls

**Risk Management:**
- **Idempotency Keys**: Prevent duplicate transactions
- **Transfer Limits**: Platform-defined maximum payouts
- **Balance Checks**: Verify sufficient funds before transfers
- **Audit Logging**: Comprehensive transaction recording

### Regulatory Compliance

**KYC/AML (via Stripe):**
- Identity verification for Express accounts
- Automatic compliance screening
- Required document collection
- Ongoing monitoring and reporting

## Operations & Monitoring

### Key Metrics to Track

**Financial Metrics:**
- Total campaign funding volume
- Creator payout completion rate
- Average payout processing time
- Platform revenue (funding - payouts)

**Technical Metrics:**
- Payment success rates
- Webhook processing latency
- Failed transaction recovery rate
- Connect account onboarding completion

### Dashboard Analytics

**Available via Admin Interface:**
```typescript
// Financial overview
- Total payments processed
- Pending payouts queue
- Failed transaction alerts
- Revenue analytics
```

### Reconciliation Process

**Daily Operations:**
1. **Stripe Dashboard Review**: Verify all transactions
2. **Database Reconciliation**: Match Stripe events with records
3. **Failed Payment Investigation**: Manual review and retry
4. **Balance Verification**: Ensure platform account sufficiency

## Troubleshooting Guide

### Common Issues

**Creator Payout Failures:**
- **Insufficient Balance**: Platform needs funding
- **Account Issues**: Creator needs to complete onboarding
- **Transfer Limits**: Stripe account limits exceeded
- **Currency Mismatches**: EUR-only system verification

**Campaign Payment Problems:**
- **Card Declined**: Brand needs to update payment method
- **Webhook Delays**: Status updates may be delayed
- **Transfer Group Missing**: Campaign setup incomplete

### Resolution Procedures

**Failed Payout Recovery:**
1. Check creator Connect account status
2. Verify platform account balance
3. Review error logs for specific issues
4. Manual retry with corrected parameters
5. Creator notification of resolution

**Payment Reconciliation:**
1. Export Stripe transaction data
2. Compare with database payment records
3. Identify discrepancies
4. Manual correction or dispute filing
5. Update financial reporting

## Development & Deployment

### Environment Configuration

**Required Environment Variables:**
```typescript
STRIPE_SECRET_KEY          // API key for server operations
STRIPE_WEBHOOK_SECRET      // Webhook signature verification
PUBLIC_BASE_URL           // Return URLs for Connect onboarding
```

### Testing Strategy

**Stripe Test Mode:**
- Use test card numbers for payment simulation
- Test webhook events with Stripe CLI
- Verify Connect account flows with test data
- Validate idempotency key effectiveness

### Deployment Considerations

**Production Readiness:**
- Webhook endpoint SSL certificate validation
- Rate limiting for API calls
- Database backup before payment processing
- Monitoring alerts for payment failures

## Future Enhancements

### Planned Features

**Enhanced Analytics:**
- Creator earnings forecasting
- Campaign ROI calculations
- Payment success rate optimization
- Churn analysis based on payout experience

**Advanced Payment Features:**
- Automatic payout scheduling
- Custom payout thresholds per creator
- Multi-currency support expansion
- Tax document generation (1099s)

### Scalability Considerations

**High-Volume Optimization:**
- Batch transfer processing
- Webhook queue management
- Database partitioning for payment records
- Stripe API rate limit optimization

---

*This Stripe integration provides a robust, scalable foundation for the two-sided marketplace, handling both brand payments and creator payouts with comprehensive error handling, security measures, and operational monitoring capabilities.*