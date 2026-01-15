/**
 * Request Context
 *
 * Provides a way to propagate request-scoped data (correlation ID, actor info)
 * through the entire request lifecycle, including async operations.
 *
 * Why use AsyncLocalStorage?
 * - Automatically propagates context through async call chains
 * - No need to pass context explicitly through every function
 * - Works with Promises, async/await, and callbacks
 *
 * Usage:
 * - Middleware sets the context at the start of each request
 * - Any code can access the current context via RequestContext.current()
 * - Context is automatically cleaned up when the request ends
 */

import { AsyncLocalStorage } from 'async_hooks';
import { v7 as uuidv7 } from 'uuid';

/**
 * Actor information - who is performing the action
 * This is extracted from the authenticated user and propagated everywhere
 */
export interface Actor {
  id: string;
  email: string;
  accountId?: string;
}

/**
 * The complete request context that flows through the system
 */
export interface IRequestContext {
  correlationId: string;
  causationId?: string;
  actor: Actor;
  requestedAt: Date;
  clientIp?: string;
  userAgent?: string;
  traceId?: string;
}

/**
 * AsyncLocalStorage instance for storing request context
 * This is a singleton that lives for the lifetime of the application
 */
const asyncLocalStorage = new AsyncLocalStorage<IRequestContext>();

/**
 * RequestContext provides static methods to manage request-scoped context
 *
 * Pattern:
 * 1. Middleware calls RequestContext.run() with the context
 * 2. All code within that run() can call RequestContext.current()
 * 3. When run() completes, context is automatically cleaned up
 */
export class RequestContext {
  /**
   * Run a function with a specific request context.
   * All async operations within the callback will have access to this context.
   */
  static run<T>(context: IRequestContext, callback: () => T): T {
    return asyncLocalStorage.run(context, callback);
  }

  /**
   * Get the current request context.
   * Returns undefined if called outside of a request context.
   */
  static current(): IRequestContext | undefined {
    return asyncLocalStorage.getStore();
  }

  /**
   * Get the current request context or throw an error.
   * Use this when context is required (e.g., in command handlers).
   */
  static currentOrFail(): IRequestContext {
    const context = asyncLocalStorage.getStore();
    if (!context) {
      throw new Error('RequestContext is not available. Ensure this code runs within a request context.');
    }
    return context;
  }

  /**
   * Get the current correlation ID, generating a new one if not in a context.
   * Useful for background jobs that may not have a request context.
   */
  static getCorrelationId(): string {
    return asyncLocalStorage.getStore()?.correlationId ?? uuidv7();
  }

  /**
   * Get the current actor or throw if not authenticated.
   */
  static getActorOrFail(): Actor {
    const context = this.currentOrFail();
    return context.actor;
  }

  /**
   * Create a new context for background processing.
   * This is used when a worker needs to process events outside of HTTP requests.
   */
  static createBackgroundContext(options: {
    correlationId: string;
    causationId?: string;
    actor: Actor;
  }): IRequestContext {
    return {
      correlationId: options.correlationId,
      causationId: options.causationId,
      actor: options.actor,
      requestedAt: new Date(),
    };
  }

  /**
   * Generate a new correlation ID.
   * Uses UUIDv7 for time-ordered, sortable IDs.
   */
  static generateCorrelationId(): string {
    return uuidv7();
  }
}
