# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Clippin** influencer marketing platform built with [Convex](https://convex.dev) as its backend. The project is connected to the Convex deployment named `enduring-snail-194`.

## Development Commands

### Primary Development

- `npm run dev` - Start both frontend (Vite) and backend (Convex) development servers concurrently
- `npm run dev:frontend` - Start only the Vite frontend development server with auto-open
- `npm run dev:backend` - Start only the Convex backend in development mode

### Build & Validation

- `npm run build` - Build the frontend application for production
- `npm run lint` - Complete validation: TypeScript check (both frontend and Convex), Convex deployment test, and Vite build

## Architecture Overview

### Tech Stack

This is a **Clippin** influencer marketing platform built with:

- **Frontend**: React 19 + TypeScript + Vite + React Router + shadcn/ui components
- **Backend**: Convex (real-time database with built-in functions)
- **Styling**: Tailwind CSS with dark/light theme support
- **Authentication**: Convex Auth
- **Payments**: Stripe integration for campaign payments and creator payouts
- **External APIs**: TikTok API for view tracking and verification

### Application Flow

**Clippin** connects brands with TikTok creators through paid campaigns:

1. **User Types**:

   - **Brands** create campaigns, set budgets, upload YouTube assets
   - **Creators** submit TikTok videos, get paid based on views

2. **Campaign Lifecycle**:

   - Brand creates campaign → Creator discovers in marketplace → Creator submits TikTok video → Brand approves/rejects → View tracking begins → Creator gets paid based on CPM rate

3. **Key Features**:
   - Real-time view tracking from TikTok API
   - Automated payouts when view thresholds are met
   - TikTok username verification system
   - Stripe Connect for creator payments

### Directory Structure

#### Frontend (`src/`)

- **Main App**: `App.tsx` - Route handling with lazy loading, authentication wrapper, theme provider
- **Authentication**: `auth/SignInForm.tsx`, `auth/SignOutButton.tsx`
- **Core Components**: `components/` directory with:
  - `Dashboard.tsx` - Main dashboard dispatcher (delegates to brand/creator dashboards)
  - `BrandDashboard.tsx`, `CreatorDashboard.tsx` - Role-specific dashboard views
  - `CampaignMarketplace.tsx` - Public campaign discovery
  - `CampaignDetails.tsx` - Individual campaign view with submission interface
  - `Navigation.tsx` - Main navigation bar with theme toggle
  - `ViewChart.tsx`, `ViewTracker.tsx` - View tracking visualizations
  - `brand-dashboard/` - Brand-specific components (campaign creation, payment modals)
  - `creator-dashboard/` - Creator-specific components (payouts, verification, submissions)
  - `campaign-marketplace/` - Marketplace-specific components
  - `ui/` - shadcn/ui components library (40+ components)
- **Utilities**: `lib/` directory with validation, error handling, constants, and utility functions
- **Hooks**: Custom hooks for mobile detection and debouncing

#### Backend (`convex/`)

- **Schema**: `schema.ts` - Database schema extending Convex Auth tables with application-specific tables
- **Core Functions**:
  - `profiles.ts` - User profile management (creator/brand types)
  - `campaigns.ts` - Campaign CRUD, budget management
  - `submissions.ts` - Video submission handling, approval workflow
  - `viewTracking.ts` + `viewTrackingHelpers.ts` - TikTok API integration, automated view updates
  - `payouts.ts` + `payoutHelpers.ts` - Stripe payment processing, payout calculations
  - `tiktokVerification.ts` - Creator username verification via TikTok profile updates
  - `optimizedQueries.ts` - Performance-optimized queries for complex data retrieval
- **Infrastructure**:
  - `auth.ts` + `auth.config.ts` - Convex Auth configuration
  - `http.ts` - HTTP endpoints (webhooks, external integrations)
  - `crons.ts` - Scheduled jobs for view tracking updates
  - `emails.ts` - Email notifications (Resend integration)
  - `logger.ts` - Centralized logging utilities
  - `migrations/` - Database migration files

### Key Data Models

**profiles** - User profiles extending Convex Auth:

- `userType`: "creator" | "brand"
- Creator: `tiktokUsername`, `tiktokVerified`, earnings tracking
- Brand: `companyName`, `companyLogo`, Stripe customer data

**campaigns** - Brand-created campaigns:

- Budget management: `totalBudget`, `remainingBudget`, `cpmRate`
- Assets: `assetLinks` (brands upload external drive links)
- Status workflow: "draft" → "active" → "completed"/"paused"

**submissions** - Creator video submissions:

- Links TikTok URLs to campaigns
- View tracking: `viewCount`, `initialViewCount`, `thresholdMetAt`
- Earnings: `earnings`, `paidOutAmount` (calculated from views × CPM)
- Status: "pending" → "approved"/"rejected"

**viewTracking** - Historical view data from TikTok API
**payments** - Stripe payment records for both campaign funding and creator payouts

### Important Patterns

#### Convex Function Syntax

**CRITICAL**: Always use the new Convex function syntax from `.cursor/rules/convex_rules.mdc`. This is enforced project-wide:

```typescript
import { query } from "./_generated/server";
import { v } from "convex/values";

export const functionName = query({
  args: { param: v.string() },
  returns: v.object({ result: v.string() }),
  handler: async (ctx, args) => {
    // function body
  },
});
```

**Key Requirements**:

- Always include `args` and `returns` validators for ALL Convex functions
- Use `v.null()` for functions that don't return anything
- Use `internalQuery`, `internalMutation`, `internalAction` for private functions
- Use `query`, `mutation`, `action` for public API functions
- HTTP endpoints use `httpAction` decorator in `convex/http.ts`

#### Authentication Pattern

```typescript
// Check if user is authenticated and get profile
const identity = await ctx.auth.getUserIdentity();
if (!identity) throw new Error("Unauthenticated");

const profile = await ctx.db
  .query("profiles")
  .withIndex("by_user_id", (q) => q.eq("userId", identity.subject))
  .unique();
```

#### Real-time Updates

The app uses Convex's real-time subscriptions extensively - changes to campaigns, submissions, and view counts automatically update across all connected clients.

#### File Naming Conventions

- React components: PascalCase (`CampaignDetails.tsx`)
- Convex functions: camelCase files with camelCase exports
- shadcn/ui components: kebab-case in `components/ui/`

### Development Notes

- **Testing**: No existing test framework - check `package.json` for testing setup before writing tests
- **Deployment**: Uses Convex deployment "enduring-snail-194" for development
- **Theming**: Dark/light theme support via `next-themes` and shadcn/ui with system preference detection
- **Forms**: Form handling with `react-hook-form` + `zod` validation (validation schemas in `lib/validation.ts`)
- **Charts**: Analytics and visualizations via `recharts`
- **Performance**: Lazy loading implemented for heavy components (`CampaignDetails`, `CampaignMarketplace`, `Dashboard`)
- **Error Handling**: Centralized error handling utilities in `lib/errorHandling.ts`
- **Logging**: Server-side logging via `convex/logger.ts`

### External Integrations

- **TikTok API**: Video view count tracking (rate limited, handled in `viewTrackingHelpers.ts`)
- **Stripe**: Payment processing, Connect accounts for creator payouts, webhooks for payment status
- **Resend**: Email notifications for campaign updates and user communications
- **YouTube**: Asset URLs for campaign reference videos (brands upload existing content links)

### Important Implementation Notes

- **Database Indexes**: Schema includes comprehensive indexes for performance - always query using indexed fields
- **File Storage**: Uses Convex file storage for user uploads (company logos, assets)
- **Scheduled Jobs**: Cron jobs handle automated view tracking updates and payout processing
- **Real-time Subscriptions**: Extensive use of Convex real-time updates for live data synchronization
- **Type Safety**: Strict TypeScript with proper ID types (`Id<"tableName">`) throughout the application
