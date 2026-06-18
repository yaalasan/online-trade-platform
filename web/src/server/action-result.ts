import { AppError } from "@/lib/errors";

/** Discriminated result type returned by every server action. */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: string };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: string, code = "ERROR"): ActionResult<never> {
  return { ok: false, error, code };
}

/**
 * Wrap a server action body so typed AppErrors become clean results and
 * unexpected errors never leak internals to the client.
 */
export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return ok(await fn());
  } catch (e) {
    if (e instanceof AppError) return fail(e.message, e.code);
    console.error("[action] unexpected error", e);
    return fail("Something went wrong. Please try again.", "INTERNAL");
  }
}
