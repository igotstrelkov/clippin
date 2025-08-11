/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as auth from "../auth.js";
import type * as campaigns from "../campaigns.js";
import type * as crons from "../crons.js";
import type * as emails from "../emails.js";
import type * as http from "../http.js";
import type * as lib_campaignService from "../lib/campaignService.js";
import type * as lib_earnings from "../lib/earnings.js";
import type * as lib_submissionService from "../lib/submissionService.js";
import type * as logger from "../logger.js";
import type * as optimizedQueries from "../optimizedQueries.js";
import type * as payoutHelpers from "../payoutHelpers.js";
import type * as payouts from "../payouts.js";
import type * as profiles from "../profiles.js";
import type * as rateLimiter from "../rateLimiter.js";
import type * as smartMonitoring from "../smartMonitoring.js";
import type * as submissions from "../submissions.js";
import type * as tiktokVerification from "../tiktokVerification.js";
import type * as viewTracking from "../viewTracking.js";
import type * as viewTrackingHelpers from "../viewTrackingHelpers.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  campaigns: typeof campaigns;
  crons: typeof crons;
  emails: typeof emails;
  http: typeof http;
  "lib/campaignService": typeof lib_campaignService;
  "lib/earnings": typeof lib_earnings;
  "lib/submissionService": typeof lib_submissionService;
  logger: typeof logger;
  optimizedQueries: typeof optimizedQueries;
  payoutHelpers: typeof payoutHelpers;
  payouts: typeof payouts;
  profiles: typeof profiles;
  rateLimiter: typeof rateLimiter;
  smartMonitoring: typeof smartMonitoring;
  submissions: typeof submissions;
  tiktokVerification: typeof tiktokVerification;
  viewTracking: typeof viewTracking;
  viewTrackingHelpers: typeof viewTrackingHelpers;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
