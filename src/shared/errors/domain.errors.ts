/**
 * Domain Errors
 *
 * Custom error classes for domain-specific exceptions.
 * These are used when we need to throw (rather than return Result types).
 *
 * When to throw vs return Result:
 * - Throw: Truly exceptional cases (programming errors, infrastructure failures)
 * - Return Result: Expected failures (validation, business rules, not found)
 */

/**
 * Base class for all domain errors.
 * Extends Error but adds structured data for logging and handling.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly httpStatus: number;

  constructor(
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

/**
 * Entity not found error.
 * Use when a requested entity doesn't exist.
 */
export class EntityNotFoundError extends DomainError {
  readonly code = 'ENTITY_NOT_FOUND';
  readonly httpStatus = 404;

  constructor(
    public readonly entityType: string,
    public readonly entityId: string,
  ) {
    super(`${entityType} with ID '${entityId}' not found`);
  }
}

/**
 * Concurrency conflict error.
 * Use when optimistic locking fails (version mismatch).
 */
export class ConcurrencyError extends DomainError {
  readonly code = 'CONCURRENCY_CONFLICT';
  readonly httpStatus = 409;

  constructor(
    public readonly entityType: string,
    public readonly entityId: string,
    public readonly expectedVersion: number,
    public readonly actualVersion: number,
  ) {
    super(
      `Concurrency conflict: ${entityType} '${entityId}' was modified. ` +
        `Expected version ${expectedVersion}, found ${actualVersion}`,
    );
  }
}

/**
 * Authorization error.
 * Use when the actor doesn't have permission for an action.
 */
export class AuthorizationError extends DomainError {
  readonly code = 'AUTHORIZATION_FAILED';
  readonly httpStatus = 403;

  constructor(
    public readonly action: string,
    public readonly resource: string,
    reason?: string,
  ) {
    super(reason ?? `Not authorized to ${action} on ${resource}`);
  }
}

/**
 * Validation error.
 * Use when input data fails validation.
 */
export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_FAILED';
  readonly httpStatus = 400;

  constructor(
    message: string,
    public readonly validationErrors: Array<{ field: string; message: string }>,
  ) {
    super(message, { validationErrors });
  }
}

/**
 * Business rule violation error.
 * Use when a business rule prevents an operation.
 */
export class BusinessRuleError extends DomainError {
  readonly code = 'BUSINESS_RULE_VIOLATION';
  readonly httpStatus = 422;

  constructor(
    public readonly rule: string,
    message: string,
  ) {
    super(message, { rule });
  }
}

/**
 * Infrastructure error.
 * Use when external services or infrastructure fails.
 */
export class InfrastructureError extends DomainError {
  readonly code = 'INFRASTRUCTURE_ERROR';
  readonly httpStatus = 503;

  constructor(
    public readonly service: string,
    message: string,
    public readonly originalError?: Error,
  ) {
    super(message, {
      service,
      originalError: originalError?.message,
    });
  }
}
