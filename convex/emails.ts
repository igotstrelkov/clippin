import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { Resend } from "resend";

const resend = new Resend(process.env.CONVEX_RESEND_API_KEY);

// Send campaign approval notification to creator
export const sendApprovalNotification = internalAction({
  args: {
    creatorEmail: v.string(),
    creatorName: v.string(),
    campaignTitle: v.string(),
    brandName: v.string(),
    earnings: v.number(),
    viewCount: v.number(),
  },
  handler: async (ctx, args) => {
    try {
      const { data, error } = await resend.emails.send({
        from: "Clippin Notifications <notifications@clippin.app>",
        to: args.creatorEmail,
        subject: `🎉 Your submission has been approved!`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #1a1a1a; color: #ffffff;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #a855f7; margin: 0; font-size: 28px;">Clippin</h1>
            </div>
            
            <div style="background-color: #16a34a; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 30px;">
              <h2 style="margin: 0; font-size: 24px;">🎉 Submission Approved!</h2>
            </div>
            
            <p style="font-size: 16px; line-height: 1.6;">Hi ${args.creatorName},</p>
            
            <p style="font-size: 16px; line-height: 1.6;">
              Great news! Your submission to the <strong>"${args.campaignTitle}"</strong> campaign by <strong>${args.brandName}</strong> has been approved!
            </p>
            
            <div style="background-color: #374151; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #a855f7;">Performance Summary</h3>
              <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span>Views:</span>
                <strong>${args.viewCount.toLocaleString()}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span>Earnings:</span>
                <strong style="color: #16a34a;">$${args.earnings.toFixed(2)}</strong>
              </div>
            </div>
            
            <p style="font-size: 16px; line-height: 1.6;">
              Your earnings will be processed and added to your account balance. Keep creating amazing content!
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://clippin.app/dashboard" style="background-color: #a855f7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                View Dashboard
              </a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #374151; margin: 30px 0;">
            
            <p style="font-size: 14px; color: #9ca3af; text-align: center;">
              This email was sent by Clippin. If you have any questions, please contact our support team.
            </p>
          </div>
        `,
      });

      if (error) {
        throw new Error(`Failed to send approval notification: ${JSON.stringify(error)}`);
      }

      return { success: true, messageId: data?.id };
    } catch (error) {
      console.error("Email sending failed:", error);
      throw new Error("Failed to send approval notification email");
    }
  },
});

// Send rejection notification to creator
export const sendRejectionNotification = internalAction({
  args: {
    creatorEmail: v.string(),
    creatorName: v.string(),
    campaignTitle: v.string(),
    brandName: v.string(),
    rejectionReason: v.string(),
    tiktokUrl: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const { data, error } = await resend.emails.send({
        from: "Clippin Notifications <notifications@clippin.app>",
        to: args.creatorEmail,
        subject: `📝 Update on your submission to "${args.campaignTitle}"`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #1a1a1a; color: #ffffff;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #a855f7; margin: 0; font-size: 28px;">Clippin</h1>
            </div>
            
            <div style="background-color: #dc2626; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 30px;">
              <h2 style="margin: 0; font-size: 24px;">📝 Submission Update</h2>
            </div>
            
            <p style="font-size: 16px; line-height: 1.6;">Hi ${args.creatorName},</p>
            
            <p style="font-size: 16px; line-height: 1.6;">
              Thank you for your submission to the <strong>"${args.campaignTitle}"</strong> campaign by <strong>${args.brandName}</strong>. 
              After review, your submission did not meet the campaign requirements at this time.
            </p>
            
            <div style="background-color: #374151; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #a855f7;">Submission Details</h3>
              <div style="margin-bottom: 10px;">
                <span>TikTok URL:</span><br>
                <a href="${args.tiktokUrl}" style="color: #a855f7; word-break: break-all;">${args.tiktokUrl}</a>
              </div>
              <div style="margin-bottom: 10px;">
                <span style="font-weight: bold;">Feedback:</span><br>
                <span style="color: #fbbf24;">${args.rejectionReason}</span>
              </div>
            </div>
            
            <p style="font-size: 16px; line-height: 1.6;">
              Don't be discouraged! Use this feedback to improve your future submissions. There are many other campaigns available in the marketplace.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://clippin.app/marketplace" style="background-color: #a855f7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Browse More Campaigns
              </a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #374151; margin: 30px 0;">
            
            <p style="font-size: 14px; color: #9ca3af; text-align: center;">
              This email was sent by Clippin. Keep creating and don't give up - your next submission could be the one!
            </p>
          </div>
        `,
      });

      if (error) {
        throw new Error(`Failed to send rejection notification: ${JSON.stringify(error)}`);
      }

      return { success: true, messageId: data?.id };
    } catch (error) {
      console.error("Email sending failed:", error);
      throw new Error("Failed to send rejection notification email");
    }
  },
});

// Send payout confirmation to creator
export const sendPayoutConfirmation = internalAction({
  args: {
    creatorEmail: v.string(),
    creatorName: v.string(),
    amount: v.number(),
    transferAmount: v.number(),
    campaignTitles: v.array(v.string()),
    totalSubmissions: v.number(),
  },
  handler: async (ctx, args) => {
    try {
      const { data, error } = await resend.emails.send({
        from: "Clippin Notifications <notifications@clippin.app>",
        to: args.creatorEmail,
        subject: `💰 Payout Confirmed - ${(args.transferAmount / 100).toFixed(2)}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #1a1a1a; color: #ffffff;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #a855f7; margin: 0; font-size: 28px;">Clippin</h1>
            </div>
            
            <div style="background-color: #16a34a; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 30px;">
              <h2 style="margin: 0; font-size: 24px;">💰 Payout Confirmed!</h2>
            </div>
            
            <p style="font-size: 16px; line-height: 1.6;">Hi ${args.creatorName},</p>
            
            <p style="font-size: 16px; line-height: 1.6;">
              Your payout has been successfully processed! Here are the details:
            </p>
            
            <div style="background-color: #374151; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #a855f7;">Payout Details</h3>
              <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span>Gross Amount:</span>
                <strong>${(args.amount / 100).toFixed(2)}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span>Platform Fee (3%):</span>
                <strong>-${((args.amount - args.transferAmount) / 100).toFixed(2)}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 10px; border-top: 1px solid #4b5563; padding-top: 10px;">
                <span>Net Transfer:</span>
                <strong style="color: #16a34a; font-size: 18px;">${(args.transferAmount / 100).toFixed(2)}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span>Submissions:</span>
                <strong>${args.totalSubmissions}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span>Campaigns:</span>
                <strong>${args.campaignTitles.length}</strong>
              </div>
            </div>
            
            ${args.campaignTitles.length > 0 ? `
              <div style="background-color: #374151; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h4 style="margin-top: 0; color: #a855f7;">Campaigns Included:</h4>
                <ul style="margin: 0; padding-left: 20px;">
                  ${args.campaignTitles.map(title => `<li style="margin-bottom: 5px;">${title}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
            
            <p style="font-size: 16px; line-height: 1.6;">
              The funds should appear in your account within 2-3 business days. Thank you for being part of the Clippin community!
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://clippin.app/dashboard" style="background-color: #a855f7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                View Dashboard
              </a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #374151; margin: 30px 0;">
            
            <p style="font-size: 14px; color: #9ca3af; text-align: center;">
              This email was sent by Clippin. If you have any questions about your payout, please contact our support team.
            </p>
          </div>
        `,
      });

      if (error) {
        throw new Error(`Failed to send payout confirmation: ${JSON.stringify(error)}`);
      }

      return { success: true, messageId: data?.id };
    } catch (error) {
      console.error("Email sending failed:", error);
      throw new Error("Failed to send payout confirmation email");
    }
  },
});

// Send campaign submission notification to brand
export const sendSubmissionNotification = internalAction({
  args: {
    brandEmail: v.string(),
    brandName: v.string(),
    campaignTitle: v.string(),
    creatorName: v.string(),
    tiktokUrl: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const { data, error } = await resend.emails.send({
        from: "Clippin Notifications <notifications@clippin.app>",
        to: args.brandEmail,
        subject: `📝 New submission for "${args.campaignTitle}"`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #1a1a1a; color: #ffffff;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #a855f7; margin: 0; font-size: 28px;">Clippin</h1>
            </div>
            
            <div style="background-color: #3b82f6; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 30px;">
              <h2 style="margin: 0; font-size: 24px;">📝 New Submission!</h2>
            </div>
            
            <p style="font-size: 16px; line-height: 1.6;">Hi ${args.brandName},</p>
            
            <p style="font-size: 16px; line-height: 1.6;">
              You have a new submission for your campaign <strong>"${args.campaignTitle}"</strong>!
            </p>
            
            <div style="background-color: #374151; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #a855f7;">Submission Details</h3>
              <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span>Creator:</span>
                <strong>${args.creatorName}</strong>
              </div>
              <div style="margin-bottom: 10px;">
                <span>TikTok URL:</span><br>
                <a href="${args.tiktokUrl}" style="color: #a855f7; word-break: break-all;">${args.tiktokUrl}</a>
              </div>
            </div>
            
            <p style="font-size: 16px; line-height: 1.6;">
              Review the submission and approve it once it meets your requirements and reaches the minimum view threshold.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://clippin.app/dashboard" style="background-color: #a855f7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Review Submission
              </a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #374151; margin: 30px 0;">
            
            <p style="font-size: 14px; color: #9ca3af; text-align: center;">
              This email was sent by Clippin. You can manage your notification preferences in your dashboard.
            </p>
          </div>
        `,
      });

      if (error) {
        throw new Error(`Failed to send submission notification: ${JSON.stringify(error)}`);
      }

      return { success: true, messageId: data?.id };
    } catch (error) {
      console.error("Email sending failed:", error);
      throw new Error("Failed to send submission notification email");
    }
  },
});

// Send campaign completion notification to brand
export const sendCampaignCompletionNotification = internalAction({
  args: {
    brandEmail: v.string(),
    brandName: v.string(),
    campaignTitle: v.string(),
    totalViews: v.number(),
    totalSpent: v.number(),
    approvedSubmissions: v.number(),
  },
  handler: async (ctx, args) => {
    try {
      const { data, error } = await resend.emails.send({
        from: "Clippin Notifications <notifications@clippin.app>",
        to: args.brandEmail,
        subject: `🎯 Campaign "${args.campaignTitle}" completed!`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #1a1a1a; color: #ffffff;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #a855f7; margin: 0; font-size: 28px;">Clippin</h1>
            </div>
            
            <div style="background-color: #16a34a; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 30px;">
              <h2 style="margin: 0; font-size: 24px;">🎯 Campaign Completed!</h2>
            </div>
            
            <p style="font-size: 16px; line-height: 1.6;">Hi ${args.brandName},</p>
            
            <p style="font-size: 16px; line-height: 1.6;">
              Your campaign <strong>"${args.campaignTitle}"</strong> has been completed! Here's a summary of the results:
            </p>
            
            <div style="background-color: #374151; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #a855f7;">Campaign Results</h3>
              <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span>Total Views:</span>
                <strong style="color: #3b82f6;">${args.totalViews.toLocaleString()}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span>Total Spent:</span>
                <strong style="color: #16a34a;">$${args.totalSpent.toFixed(2)}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span>Approved Submissions:</span>
                <strong>${args.approvedSubmissions}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span>Effective CPM:</span>
                <strong>${args.totalViews > 0 ? `$${((args.totalSpent / args.totalViews) * 1000).toFixed(2)}` : '$0.00'}</strong>
              </div>
            </div>
            
            <p style="font-size: 16px; line-height: 1.6;">
              Thank you for using Clippin for your campaign! We hope you achieved great results and look forward to your next campaign.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://clippin.app/dashboard" style="background-color: #a855f7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                View Dashboard
              </a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #374151; margin: 30px 0;">
            
            <p style="font-size: 14px; color: #9ca3af; text-align: center;">
              This email was sent by Clippin. Ready to launch another campaign? Create one from your dashboard!
            </p>
          </div>
        `,
      });

      if (error) {
        throw new Error(`Failed to send campaign completion notification: ${JSON.stringify(error)}`);
      }

      return { success: true, messageId: data?.id };
    } catch (error) {
      console.error("Email sending failed:", error);
      throw new Error("Failed to send campaign completion notification email");
    }
  },
});
