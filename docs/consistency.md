# Consistency & Versioning Strategy

This document explains how Veritas handles consistency across aggregates and manages event schema evolution.

---

## Cross-Aggregate Consistency

### The Problem

In a modular system with multiple aggregates, how do we maintain consistency when operations span multiple entities?

**Example**: Creating a Policy requires validating that the User exists and is active.

**Bad solution**: Direct database query across aggregates
```typescript
// ❌ DON'T DO THIS
const user = await db.select().from(users).where(eq(users.id, userId));
if (!user || user.status !== 'active') {
  throw new Error('User not active');
}
await db.insert(policies).values({...});
```

**Why bad?**
- Tight coupling between aggregates
- Breaks aggregate boundaries
- Makes extraction to services impossible

---

### Our Strategy: Eventual Consistency

**Veritas uses eventual consistency for cross-aggregate operations.**

#### Pattern 1: Optimistic Validation

Assume the user exists and is active. If not, the operation will fail later.

```typescript
// Policy aggregate doesn't validate user existence
const policy = PolicyAggregate.create(userId, ...);

// If user doesn't exist, foreign key constraint fails
// Error is caught and returned to user
```

**When to use**: Simple validations where failure is acceptable.

#### Pattern 2: Event-Driven Validation

Emit events and let handlers enforce consistency.

```typescript
// 1. Create policy (always succeeds)
const policy = PolicyAggregate.create(userId, ...);
await repo.save(policy, events);

// 2. Event handler validates user
@EventHandler(['policy.created'])
class PolicyUserValidator {
  async handle(event: PolicyCreatedEvent) {
    const user = await userRepo.findById(event.payload.userId);
    
    if (!user || user.status !== 'active') {
      // Emit compensation event
      await commandBus.execute(new RevokePolicyCommand({
        policyId: event.aggregateId,
        reason: 'User not active'
      }));
    }
  }
}
```

**When to use**: Complex validations, compensating actions needed.

#### Pattern 3: Saga Pattern

Coordinate multi-step workflows across aggregates.

```typescript
// Example: Activate policy requires user approval
class ActivatePolicySaga {
  async execute(policyId: string) {
    // Step 1: Request approval
    await commandBus.execute(new RequestApprovalCommand({ policyId }));
    
    // Step 2: Wait for approval event
    // (handled by saga state machine)
    
    // Step 3: Activate policy
    await commandBus.execute(new ActivatePolicyCommand({ policyId }));
  }
  
  async compensate() {
    // Rollback if any step fails
    await commandBus.execute(new RevokePolicyCommand({ policyId }));
  }
}
```

**When to use**: Long-running workflows, multiple aggregates, compensation needed.

---

## No Distributed Transactions

**Veritas explicitly rejects distributed transactions.**

### Why?

1. **Don't scale**: 2-phase commit locks resources across services
2. **Fragile**: Network partitions cause indefinite blocking
3. **Complex**: Requires distributed transaction coordinator
4. **Unnecessary**: Eventual consistency is sufficient for business needs

### What About ACID?

**ACID guarantees exist within aggregate boundaries:**

```typescript
// Single aggregate transaction (ACID)
await eventStore.withTransaction(async (tx, persistEvents) => {
  await tx.insert(policies).values({...});  // State
  await persistEvents([policyCreated]);      // Events
});
// Either both succeed or both fail
```

**Across aggregates, we have BASE:**
- **B**asically **A**vailable: System remains operational
- **S**oft state: State may be temporarily inconsistent
- **E**ventual consistency: Consistency achieved over time

### Example: Policy Activation Requires User Approval

**Without distributed transactions:**

```typescript
// Step 1: User approves (separate transaction)
await userRepo.update(user, [userApprovedEvent]);

// Step 2: Policy activates (separate transaction)
await policyRepo.update(policy, [policyActivatedEvent]);

// If step 2 fails, step 1 already committed
// Compensation: Emit PolicyActivationFailed event
```

**Consistency is eventual:**
- User approval happens first
- Policy activation happens shortly after
- If activation fails, compensation event reverts approval
- Final state is consistent, but there's a brief window of inconsistency

**Why acceptable?**
- Business can tolerate brief inconsistency (milliseconds to seconds)
- Compensation handles failures
- Audit trail shows what happened

---

## Event Versioning

### The Challenge

Events are immutable. Once published, they can't be changed. But requirements evolve.

**Example**: `PolicyCreated` initially has:
```typescript
{
  policyId: string;
  userId: string;
  name: string;
}
```

Later, we need to add `approvalRequired: boolean`.

How do we evolve the schema without breaking existing consumers?

---

### Strategy 1: Additive Changes (Preferred)

**Add optional fields, never remove or rename.**

```typescript
// v1 (original)
interface PolicyCreatedPayload_v1 {
  policyId: string;
  userId: string;
  name: string;
}

// v2 (add optional field)
interface PolicyCreatedPayload_v2 extends PolicyCreatedPayload_v1 {
  approvalRequired?: boolean;  // Optional, defaults to false
}

// Consumers handle both versions
function handle(event: PolicyCreatedEvent) {
  const approvalRequired = event.payload.approvalRequired ?? false;
  // Works for v1 (undefined → false) and v2 (explicit value)
}
```

**When to use**: 90% of schema changes.

**Pros**:
- Backward compatible
- No migration needed
- Old events still valid

**Cons**:
- Schema grows over time
- Optional fields everywhere

---

### Strategy 2: Versioned Events

**Publish new event type for breaking changes.**

```typescript
// Old event (deprecated)
const PolicyCreatedEvent = 'policy.created.v1';

// New event (current)
const PolicyCreatedEvent_v2 = 'policy.created.v2';

interface PolicyCreatedPayload_v2 {
  policyId: string;
  userId: string;
  name: string;
  approvalRequired: boolean;  // Required, not optional
  rules: PolicyRule[];        // New structure
}
```

**Consumers handle both:**
```typescript
@EventHandler(['policy.created.v1', 'policy.created.v2'])
class PolicyAuditHandler {
  async handle(event: IDomainEvent) {
    if (event.eventType === 'policy.created.v1') {
      return this.handleV1(event);
    } else {
      return this.handleV2(event);
    }
  }
}
```

**When to use**: Breaking changes (rename, remove, change type).

**Pros**:
- Clean separation of versions
- Explicit handling of differences

**Cons**:
- Consumers must handle multiple versions
- More code to maintain

---

### Strategy 3: Upcasting

**Transform old events to new schema on read.**

```typescript
class EventUpcaster {
  upcast(event: IDomainEvent): IDomainEvent {
    if (event.eventType === 'policy.created.v1') {
      return {
        ...event,
        eventType: 'policy.created.v2',
        payload: {
          ...event.payload,
          approvalRequired: false,  // Default for old events
          rules: [],                // Empty for old events
        },
      };
    }
    return event;
  }
}

// Apply before handling
const upcastedEvent = upcaster.upcast(rawEvent);
await handler.handle(upcastedEvent);
```

**When to use**: Many old events, don't want to handle multiple versions in every consumer.

**Pros**:
- Consumers only handle latest version
- Centralized transformation logic

**Cons**:
- Upcasting logic must be maintained
- Performance overhead on reads

---

### Our Approach

**Veritas uses a hybrid strategy:**

1. **Prefer additive changes** (Strategy 1)
   - Add optional fields
   - Use sensible defaults
   - Document in event schema

2. **Version events for breaking changes** (Strategy 2)
   - Publish `v2` event type
   - Support both versions for 6 months
   - Deprecate old version

3. **Upcast if needed** (Strategy 3)
   - Only for high-volume events
   - Centralize in `EventUpcaster` service

---

## Event Schema Evolution Example

### Initial Schema (v1)

```typescript
export interface PolicyCreatedPayload {
  policyId: string;
  userId: string;
  name: string;
  createdAt: string;
}

export const PolicyEventTypes = {
  POLICY_CREATED: 'policy.created',
} as const;
```

### Additive Change (v1.1)

```typescript
export interface PolicyCreatedPayload {
  policyId: string;
  userId: string;
  name: string;
  description?: string;        // NEW: Optional field
  approvalRequired?: boolean;  // NEW: Optional field
  createdAt: string;
}

// Event type unchanged: still 'policy.created'
```

**Migration**: None needed. Old events still valid.

### Breaking Change (v2)

```typescript
// Old payload (deprecated)
export interface PolicyCreatedPayload_v1 {
  policyId: string;
  userId: string;
  name: string;
  createdAt: string;
}

// New payload (current)
export interface PolicyCreatedPayload_v2 {
  policyId: string;
  userId: string;
  name: string;
  description: string;         // Now required
  rules: PolicyRule[];         // New structure
  metadata: {                  // Nested structure
    approvalRequired: boolean;
    createdBy: string;
  };
  createdAt: string;
}

export const PolicyEventTypes = {
  POLICY_CREATED_V1: 'policy.created.v1',  // Deprecated
  POLICY_CREATED: 'policy.created.v2',     // Current
} as const;
```

**Migration**:
1. Deploy code that handles both versions
2. Start publishing v2 events
3. Update consumers to handle v2
4. After 6 months, remove v1 handling

---

## Handling Schema Mismatches

### Problem: Consumer Expects v2, Receives v1

```typescript
// Consumer expects v2 structure
function handle(event: PolicyCreatedEvent_v2) {
  const rules = event.payload.rules;  // ❌ Undefined for v1 events
}
```

### Solution: Defensive Handling

```typescript
function handle(event: IDomainEvent) {
  const payload = event.payload as PolicyCreatedPayload_v2;
  
  // Provide defaults for missing fields
  const rules = payload.rules ?? [];
  const approvalRequired = payload.metadata?.approvalRequired ?? false;
  
  // Process with defaults
}
```

### Solution: Explicit Version Check

```typescript
function handle(event: IDomainEvent) {
  if (event.eventType === 'policy.created.v1') {
    return this.handleV1(event as PolicyCreatedEvent_v1);
  } else if (event.eventType === 'policy.created.v2') {
    return this.handleV2(event as PolicyCreatedEvent_v2);
  } else {
    throw new Error(`Unknown event version: ${event.eventType}`);
  }
}
```

---

## Deprecation Policy

**When introducing breaking changes:**

1. **Announce deprecation** (in code comments and docs)
   ```typescript
   /**
    * @deprecated Use policy.created.v2 instead. Will be removed in Q3 2026.
    */
   export const POLICY_CREATED_V1 = 'policy.created.v1';
   ```

2. **Support both versions** (minimum 6 months)
   - Publish new version
   - Consumers handle both
   - Monitor usage of old version

3. **Remove old version** (after grace period)
   - Stop publishing old events
   - Remove old event handlers
   - Archive old event definitions

---

## Read Model Consistency

### Problem

Read models are built from events. If event schema changes, read models may become inconsistent.

### Solution: Rebuild from Events

```typescript
// Rebuild read model from event log
async function rebuildPolicyReadModel() {
  await db.delete(policyReadModel);  // Clear existing
  
  const events = await eventStore.getEventsByAggregateType('Policy');
  
  for (const event of events) {
    const upcastedEvent = upcaster.upcast(event);  // Transform to latest version
    await applyEventToReadModel(upcastedEvent);
  }
}
```

**When to rebuild:**
- After schema migration
- If read model corrupted
- To add new read model projections

**Why possible:**
- Events are immutable (source of truth)
- Upcasting ensures latest schema
- Read models are disposable (can rebuild anytime)

---

## Summary

### Cross-Aggregate Consistency
- ✅ **Eventual consistency** via events
- ✅ **No distributed transactions**
- ✅ **Compensation** for failures
- ✅ **Sagas** for complex workflows

### Event Versioning
- ✅ **Additive changes** preferred (optional fields)
- ✅ **Versioned events** for breaking changes
- ✅ **Upcasting** for backward compatibility
- ✅ **Deprecation policy** (6 month grace period)

### Read Models
- ✅ **Rebuildable** from event log
- ✅ **Eventually consistent** with current state
- ✅ **Upcasting** ensures latest schema

**Key insight**: Immutable events + upcasting = schema evolution without data migration.
