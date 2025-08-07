import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { logger } from "./logger";

const http = httpRouter();

// Stripe webhook route
http.route({
  path: "/stripe",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const signature = request.headers.get("stripe-signature") as string;
    const body = await request.text();

    try {
      const result = await ctx.runAction(internal.payouts.handleWebhook, {
        signature,
        body,
      });

      if (result.success) {
        return new Response(null, {
          status: 200,
        });
      } else {
        return new Response("Webhook Error", {
          status: 400,
        });
      }
    } catch (err) {
      logger.error("Stripe webhook processing failed", {
        error: err instanceof Error ? err : new Error(String(err)),
      });
      return new Response("Webhook Error", {
        status: 400,
      });
    }
  }),
});

auth.addHttpRoutes(http);

export default http;
