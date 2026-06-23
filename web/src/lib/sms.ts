/**
 * Pluggable SMS sender for phone/OTP login.
 *
 * Suppliers in mainland China log in by phone + SMS code, so this is the path
 * that must work behind the Great Firewall — i.e. a Chinese provider, not a
 * foreign one. Pick the provider with SMS_PROVIDER:
 *
 *   - "console" (default): logs the message to the server console. Lets you test
 *     the whole phone-login flow locally without any provider credentials.
 *   - "aliyun":  Alibaba Cloud Dysms.   Needs ALIYUN_SMS_* env vars.
 *   - "tencent": Tencent Cloud SMS.     Needs TENCENT_SMS_* env vars.
 *
 * The aliyun/tencent branches are intentionally left as a single integration
 * point: drop in the provider SDK call and the rest of the auth stack is unchanged.
 */
const PROVIDER = (process.env.SMS_PROVIDER ?? "console").toLowerCase();

export async function sendSms(to: string, message: string): Promise<void> {
  switch (PROVIDER) {
    case "console": {
      // Visible in `journalctl -u fastflow-portal` / dev terminal.
      console.log(`[SMS:console] -> ${to}: ${message}`);
      if (process.env.NODE_ENV === "production") {
        console.warn(
          "[SMS] SMS_PROVIDER is still 'console' in production — OTP codes are " +
            "only printed to the log, not delivered. Configure aliyun/tencent.",
        );
      }
      return;
    }
    case "aliyun": {
      // TODO: integrate Alibaba Cloud Dysmsapi (SendSms) here.
      // Required env: ALIYUN_SMS_ACCESS_KEY_ID, ALIYUN_SMS_ACCESS_KEY_SECRET,
      // ALIYUN_SMS_SIGN_NAME, ALIYUN_SMS_TEMPLATE_CODE.
      throw new Error("Aliyun SMS provider not yet wired up (see src/lib/sms.ts).");
    }
    case "tencent": {
      // TODO: integrate Tencent Cloud SMS (SendSms) here.
      throw new Error("Tencent SMS provider not yet wired up (see src/lib/sms.ts).");
    }
    default:
      throw new Error(`Unknown SMS_PROVIDER: ${PROVIDER}`);
  }
}
