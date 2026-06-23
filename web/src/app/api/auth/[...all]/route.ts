import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth/server";

// Mounts better-auth's sign-in / sign-up / OTP / session endpoints at /api/auth/*.
export const { GET, POST } = toNextJsHandler(auth.handler);
