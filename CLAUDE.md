# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

**Clippin** is a creator economy platform that connects brands with TikTok creators for sponsored video campaigns. The platform manages the complete campaign lifecycle from creation to creator payments, featuring real-time view tracking, automated earnings calculation, and Stripe-powered payouts.

## Development Commands

### Essential Commands

- `npm run dev` - Start development servers (frontend + Convex backend in parallel)
- `npm run build` - Build frontend for production
- `npm run lint` - Run comprehensive validation (TypeScript check + Convex dev + Vite build)
- `npm test` - Run test suite with Vitest
- `npm run test:coverage` - Run tests with coverage report
- `npm run test:ui` - Run tests with UI interface

### Convex-Specific Commands

- `npm run dev:backend` - Start only Convex development server
- `npm run dev:frontend` - Start only Vite development server

### Testing Individual Components

- `npx vitest run tests/campaignService.test.ts` - Run specific test file
- `npx vitest run --grep "validateCampaignCreation"` - Run specific test pattern

## Platform Architecture

### Technology Stack

- **Frontend**: React 19 + TypeScript + Vite + TailwindCSS + shadcn/ui
- **Backend**: Convex (real-time database with serverless functions)
- **Authentication**: Convex Auth (configured in `convex/auth.ts`)
- **Payments**: Stripe with Stripe Connect for creator payouts
- **External APIs**: TikTok and Instagram Scraper API via RapidAPI for view tracking
- **Testing**: Vitest with edge-runtime environment for Convex compatibility

### Key Directories

- `convex/` - Backend functions, schema, and business logic
- `convex/lib/` - Pure business logic services (campaignService, submissionService, earnings)
- `src/components/` - React components organized by domain
- `src/components/ui/` - Reusable shadcn/ui components
- `tests/` - Test files matching convex structure
- `docs/` - Technical documentation (view-calculation.md, stripe-integration.md)

## Core Business Logic

### User Roles & Access Patterns

- **Creators**: Submit content to campaigns, track earnings, request payouts
- **Brands**: Create campaigns, manage budgets, approve submissions
- **Admins**: Platform oversight and analytics

### Campaign Lifecycle

1. **Draft** → Brand creates campaign (pending payment)
2. **Active** → Campaign accepting creator submissions
3. **Paused** → Temporarily stopped (can resume)
4. **Completed** → Ended (budget exhausted or manually closed)

### View Tracking System

- **Smart Monitoring Tiers**: Hot (15min) → Warm (1hr) → Cold (6hr) → Archived (24hr)
- **Rate Limiting**: 120 requests/minute to TikTok and InstagramAPI with automatic retry
- **Real-time Calculations**: View increases → earnings updates → budget decreases

### Earnings Formula

```typescript
// CPM-based calculation (stored in cents)
const earningsInCents = Math.round((viewCount / 1000) * (cpmRate / 100) * 100);
const finalEarnings = Math.min(earningsInCents, maxPayoutPerSubmission);
```

## Critical Convex Development Rules

### Function Syntax (ALWAYS use new syntax)

```typescript
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const exampleQuery = query({
  args: { userId: v.id("users") },
  returns: v.array(v.object({ name: v.string() })),
  handler: async (ctx, args) => {
    // Function body
  },
});
```

### Validation Requirements

- **ALWAYS** include `args` and `returns` validators for ALL functions
- Use `v.null()` for functions that don't return values
- Use `v.id(tableName)` for document IDs, not `v.string()`
- Include `as const` for string literals in discriminated unions

### Database Operations

- **NO** `.filter()` in queries - use indexed queries with `.withIndex()`
- **NO** `.delete()` on query results - use `.collect()` then iterate with `ctx.db.delete()`
- Use `.unique()` for single document queries (throws if multiple found)
- Use `ctx.db.patch()` for partial updates, `ctx.db.replace()` for full replacement

### Function References & Calling

- Use `api.filename.functionName` for public functions
- Use `internal.filename.functionName` for internal functions
- Include type annotations when calling functions in same file to avoid TypeScript circularity

### Schema Design Principles

- System fields `_id` and `_creationTime` automatically added
- Index names must include all fields: `by_field1_and_field2`
- Query index fields in same order as defined
- Use appropriate validators: `v.id()`, `v.union()`, `v.optional()`, `v.array()`

## Service Layer Architecture

### Business Logic Separation

Pure business logic is extracted to `convex/lib/` services:

- `campaignService.ts` - Campaign validation, status transitions, statistics
- `submissionService.ts` - Submission processing, view updates, earnings
- `earnings.ts` - Budget validation, earnings calculations

### Testing Strategy

- Test business logic in isolation using imported service functions
- Use `convex-test` for integration testing with database operations
- Mock external APIs (TikTok, Instagram, Stripe) in test environment
- Test edge cases: budget exhaustion, rate limiting, invalid transitions

## Authentication & Security

### Convex Auth Setup

- OAuth providers configured in `convex/auth.config.ts`
- User sessions managed automatically by Convex Auth
- Role-based access control through `profiles` table linking to `users`

### Access Control Patterns

```typescript
// Always verify user permissions
const profile = await ctx.db
  .query("profiles")
  .withIndex("by_user_id", (q) => q.eq("userId", ctx.auth.getUserId()))
  .unique();

if (profile?.userType !== "brand") {
  throw new Error("Unauthorized");
}
```

## External API Integration

### TikTok View Tracking

- **Rate Limit**: 120 requests/minute via internal rate limiter
- **Error Handling**: Retry on 429, graceful degradation on failure
- **URL Patterns**: Supports tiktok.com/@user/video/id and vm.tiktok.com/shortcode
- **Monitoring**: Smart tier system reduces API calls for stable videos

### Instagram View Tracking

- **Rate Limit**: 120 requests/minute via internal rate limiter
- **Error Handling**: Retry on 429, graceful degradation on failure
- **URL Patterns**: Supports instagram.com/reel/id and vm.instagram.com/p/id
- **Monitoring**: Smart tier system reduces API calls for stable videos

### Stripe Integration

- **Campaign Payments**: PaymentIntents for brand campaign funding
- **Creator Payouts**: Stripe Connect transfers to creator accounts
- **Webhook Handling**: Real-time payment status updates via `convex/http.ts`

## Component Architecture

### Domain Organization

- `auth/` - Authentication forms and components
- `brand-dashboard/` - Campaign management, payments
- `creator-dashboard/` - Submissions, earnings, payouts
- `campaign-marketplace/` - Public campaign browsing

### State Management

- Convex provides real-time subscriptions - avoid external state managers
- Use React Query pattern with Convex hooks: `useQuery(api.campaigns.list)`
- Local state only for UI interactions, not data synchronization

### UI Components

- Built on shadcn/ui component library
- Consistent theming via CSS variables in `src/index.css`
- Dark/light mode support through `next-themes`

## Development Workflow

### Convex Development

- Connected to deployment: `enduring-snail-194`
- Schema changes auto-generate types in `convex/_generated/`
- Functions deployed automatically on save during development
- Use `convex dev --once` for CI/CD validation

### Database Migrations

- Place migration files in `convex/migrations/`
- Test migrations thoroughly - they run on production data
- Consider backwards compatibility for schema changes

### Performance Considerations

- Convex functions have execution time limits
- Use pagination for large result sets: `paginationOptsValidator`
- Index queries properly to avoid slow table scans
- Rate limit external API calls to prevent quota exhaustion

## Common Gotchas

### Convex-Specific Issues

- Functions must be pure - no file system access or global state
- Use `"use node";` directive for Node.js APIs in actions only
- HTTP endpoints defined in `convex/http.ts` with exact path matching
- Cron jobs use `cronJobs()` builder pattern, not helper methods

### Business Logic Pitfalls

- Always validate budget constraints before updating earnings
- Check campaign status before accepting new submissions
- Verify TikTok and Instagram URL ownership before approving submissions
- Handle race conditions in view update calculations

### Testing Considerations

- Use edge-runtime environment for Convex function compatibility
- Mock external APIs to avoid rate limits and costs
- Test error boundaries and fallback behaviors
- Validate both happy path and edge cases for business logic
