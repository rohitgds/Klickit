import type { MessagingProvider } from "./interfaces.js";

export type PabblyAdapterMode = "development" | "production";

export type PabblyMessagingAdapter = MessagingProvider & {
  verifyWebhookSignature(input: { signature: string | undefined; payload: string; secret?: string }): boolean;
};

export function createPabblyMessagingAdapter(input: {
  mode?: PabblyAdapterMode;
  webhookSecret?: string;
}): PabblyMessagingAdapter {
  const mode = input.mode ?? "development";
  return {
    kind: "messaging",
    async sendMessage(message) {
      if (mode === "development") {
        return {
          queued: true,
          provider: "pabbly-stub",
          providerMessageId: `dev-${message.deduplicationKey ?? message.templateId}`,
        };
      }
      return {
        queued: false,
        provider: "pabbly-stub",
        providerMessageId: undefined,
      };
    },
    verifyWebhookSignature({ signature, payload, secret }) {
      if (!signature || !secret) {
        return mode === "development";
      }
      return signature === `sha256=${Buffer.from(`${secret}:${payload}`).toString("hex").slice(0, 32)}`;
    },
  };
}
