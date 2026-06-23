"use client";

import { createAuthClient } from "better-auth/react";
import { phoneNumberClient } from "better-auth/client/plugins";

/**
 * Browser-side auth client. Talks to /api/auth/* on our own origin only — no
 * third-party script, so it loads fine inside mainland China.
 */
export const authClient = createAuthClient({
  plugins: [phoneNumberClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
