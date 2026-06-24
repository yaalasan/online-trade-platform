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
      const Dysmsapi = (await import("@alicloud/dysmsapi20170525")).default;
      const OpenApiClient = (await import("@alicloud/openapi-client")).default;

      const config = new OpenApiClient.Config({
        accessKeyId: process.env.ALIYUN_SMS_ACCESS_KEY_ID,
        accessKeySecret: process.env.ALIYUN_SMS_ACCESS_KEY_SECRET,
        endpoint: "dysmsapi.aliyuncs.com",
      });

      const client = new Dysmsapi(config);
      const SendSmsRequest = (await import("@alicloud/dysmsapi20170525")).SendSmsRequest;
      const req = new SendSmsRequest({
        phoneNumbers: to,
        signName: process.env.ALIYUN_SMS_SIGN_NAME,
        templateCode: process.env.ALIYUN_SMS_TEMPLATE_CODE,
        // Your Aliyun template must have a ${code} variable.
        templateParam: JSON.stringify({ code: message.match(/\d{4,8}/)?.[0] ?? message }),
      });

      const resp = await client.sendSms(req);
      if (resp.body?.code !== "OK") {
        throw new Error(`Aliyun SMS error: ${resp.body?.code} — ${resp.body?.message}`);
      }
      return;
    }
    case "tencent": {
      // TODO: integrate Tencent Cloud SMS (SendSms) here.
      throw new Error("Tencent SMS provider not yet wired up (see src/lib/sms.ts).");
    }
    default:
      throw new Error(`Unknown SMS_PROVIDER: ${PROVIDER}`);
  }
}
