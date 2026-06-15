// Typed errors so server actions can return predictable results instead of leaking stacks.

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "AppError";
  }
}

/** 401 — not signed in / no synced user. */
export class UnauthenticatedError extends AppError {
  constructor(message = "Authentication required.") {
    super(message, "UNAUTHENTICATED", 401);
  }
}

/** 403 — signed in but lacks permission, or acting outside their membership. */
export class AuthorizationError extends AppError {
  constructor(message = "You are not allowed to perform this action.") {
    super(message, "FORBIDDEN", 403);
  }
}

/** 400 — invalid input. */
export class ValidationError extends AppError {
  constructor(message = "Invalid input.") {
    super(message, "VALIDATION", 400);
  }
}

/** 404. */
export class NotFoundError extends AppError {
  constructor(message = "Not found.") {
    super(message, "NOT_FOUND", 404);
  }
}
