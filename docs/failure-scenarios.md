# Failure Scenarios & Observability

This document explains how to trigger, observe, and investigate failures in Veritas.

---

## Controlled Failure Demonstration

The `PolicyAuditHandler` includes built-in failure simulation for testing retry logic.

### How to Trigger Failure

Create a policy with `simulateFailure` metadata:

```typescript
POST /api/policies
{
  "name": "Test Policy",
  "description": "Testing failure scenarios",
  "rules": { "test": true },
  "simulateFailure": true  // ← Triggers controlled failure
}
```

### What Happens

**Attempt 1**: Handler throws error
```
Error: Simulated failure (attempt 1/3). This will trigger retry logic.
```

**Attempt 2**: Handler throws error again
```
Error: Simulated failure (attempt 2/3). This will trigger retry logic.
```

**Attempt 3**: Handler succeeds
```
Final retry attempt - allowing success
```

### Retry Behavior

BullMQ configuration (from `outbox-processor.service.ts`):
```typescript
{
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000  // 1s, 2s, 4s
  }
}
```

**Timeline:**
- `T+0s`: Event published, attempt 1 fails
- `T+1s`: Retry attempt 2 fails
- `T+3s`: Retry attempt 3 succeeds
- Total time: ~4 seconds

---

## Observing Failures

### 1. Application Logs

**Structured JSON logs** show each attempt:

```json
{
  "level": "warn",
  "message": "Simulating failure for testing",
  "eventType": "policy.created",
  "aggregateId": "01932e4f-8b2a-7890-a123-456789abcdef",
  "attempt": 1,
  "correlationId": "req-abc123"
}
```

**Filter by correlation ID** to trace entire flow:
```bash
# PowerShell
Get-Content logs/app.log | Select-String "req-abc123"
```

### 2. Event Outbox Table

**Query pending/failed events:**

```sql
-- Check retry count
SELECT 
  id,
  event_type,
  aggregate_id,
  status,
  retry_count,
  max_retries,
  last_error,
  next_retry_at
FROM event_outbox
WHERE status IN ('pending', 'processing', 'failed')
ORDER BY created_at DESC;
```

**Example output:**
```
| id   | event_type     | status     | retry_count | last_error                    |
|------|----------------|------------|-------------|-------------------------------|
| uuid | policy.created | processing | 2           | Simulated failure (attempt 2) |
```

### 3. BullMQ Queue Inspection

**Via Redis CLI:**

```bash
redis-cli

# List failed jobs
LRANGE bull:domain-events:failed 0 -1

# Get job details
HGETALL bull:domain-events:<job-id>
```

**Via BullMQ Board** (if installed):
```bash
npm install -g bull-board
bull-board
```

Navigate to `http://localhost:3000` to see:
- Active jobs
- Failed jobs
- Retry attempts
- Job data and stack traces

### 4. Processed Events Table

**Check idempotency tracking:**

```sql
SELECT 
  event_id,
  handler_name,
  processed_at
FROM processed_events
WHERE event_id = '<event-id>'
ORDER BY processed_at DESC;
```

If event appears multiple times with same handler, idempotency is working.

---

## Dead Letter Behavior

### When Max Retries Exceeded

If all 3 attempts fail, the job moves to **failed** status:

```typescript
@OnQueueFailed()
async onFailed(job: Job, error: Error) {
  logger.error({
    message: 'Event processing failed after max retries',
    eventId: job.data.eventId,
    eventType: job.data.eventType,
    attempts: job.attemptsMade,
    error: error.message
  });
}
```

**Outbox entry updated:**

```sql
UPDATE event_outbox
SET 
  status = 'failed',
  retry_count = 3,
  last_error = 'Simulated failure (attempt 3/3)'
WHERE id = '<outbox-id>';
```

### Manual Inspection

**1. Find failed events:**

```sql
SELECT 
  eo.id,
  eo.event_type,
  eo.aggregate_id,
  eo.retry_count,
  eo.last_error,
  eo.created_at,
  de.payload
FROM event_outbox eo
JOIN domain_events de ON eo.event_id = de.id
WHERE eo.status = 'failed'
ORDER BY eo.created_at DESC;
```

**2. Inspect event payload:**

```sql
SELECT payload 
FROM domain_events 
WHERE id = '<event-id>';
```

**3. Check audit trail:**

```sql
SELECT *
FROM audit_log
WHERE correlation_id = '<correlation-id>'
ORDER BY occurred_at;
```

### Manual Retry

**Option 1: Reset outbox entry**

```sql
UPDATE event_outbox
SET 
  status = 'pending',
  retry_count = 0,
  next_retry_at = NOW()
WHERE id = '<outbox-id>';
```

Outbox processor will pick it up on next poll (within 1 second).

**Option 2: Trigger manual processing**

```typescript
// Via admin API or script
const outboxProcessor = app.get(OutboxProcessorService);
await outboxProcessor.triggerProcessing();
```

**Option 3: Republish event**

```typescript
// Create new outbox entry for same event
await eventStore.withTransaction(async (tx, persistEvents) => {
  const event = await getEventById(eventId);
  await persistEvents([event]);
});
```

---

## Operator Investigation Workflow

### Scenario: User reports "Policy created but no audit log"

**Step 1: Find the policy**

```sql
SELECT * FROM policies WHERE id = '<policy-id>';
```

**Step 2: Find the event**

```sql
SELECT * FROM domain_events 
WHERE aggregate_type = 'Policy' 
  AND aggregate_id = '<policy-id>'
  AND event_type = 'policy.created';
```

**Step 3: Check outbox status**

```sql
SELECT * FROM event_outbox 
WHERE event_id = '<event-id>';
```

**Possible outcomes:**

| Status | Meaning | Action |
|--------|---------|--------|
| `completed` | Event published successfully | Check worker logs |
| `pending` | Not yet processed | Wait or trigger manual processing |
| `processing` | Currently being processed | Check retry count |
| `failed` | Max retries exceeded | Inspect `last_error`, manual retry |

**Step 4: Check if handler processed it**

```sql
SELECT * FROM processed_events 
WHERE event_id = '<event-id>' 
  AND handler_name = 'PolicyAuditHandler';
```

If exists, handler ran successfully. Check audit log:

```sql
SELECT * FROM audit_log 
WHERE entity_type = 'Policy' 
  AND entity_id = '<policy-id>';
```

**Step 5: Check worker logs**

```bash
# Filter by event ID
grep "<event-id>" logs/worker.log

# Or by correlation ID
grep "<correlation-id>" logs/worker.log
```

Look for:
- Handler execution logs
- Error stack traces
- Retry attempts

---

## Common Failure Patterns

### 1. Database Connection Timeout

**Symptom**: Handler fails with "connection timeout"

**Cause**: Database overloaded or network issue

**Resolution**:
- Events will retry automatically
- Check database health
- Scale database if needed

**Observation**:
```sql
SELECT status, COUNT(*) 
FROM event_outbox 
GROUP BY status;
```

If many `processing` events, database may be slow.

### 2. Idempotency Violation

**Symptom**: Duplicate audit logs for same event

**Cause**: Idempotency check failed or skipped

**Resolution**:
- Check `processed_events` table
- Verify handler uses idempotency pattern

**Observation**:
```sql
SELECT event_id, COUNT(*) 
FROM processed_events 
GROUP BY event_id 
HAVING COUNT(*) > 1;
```

### 3. Poison Message

**Symptom**: Event fails repeatedly, blocking queue

**Cause**: Invalid event payload or handler bug

**Resolution**:
- Move to dead-letter queue
- Fix handler bug
- Manually process or discard

**Observation**:
```sql
SELECT * FROM event_outbox 
WHERE retry_count >= max_retries 
  AND status = 'failed';
```

---

## Metrics to Monitor

### Outbox Health

```sql
-- Outbox lag (events pending > 5 seconds)
SELECT COUNT(*) 
FROM event_outbox 
WHERE status = 'pending' 
  AND created_at < NOW() - INTERVAL '5 seconds';
```

### Worker Performance

```sql
-- Average processing time (via audit logs)
SELECT 
  AVG(EXTRACT(EPOCH FROM (occurred_at - created_at))) as avg_seconds
FROM audit_log
WHERE occurred_at > NOW() - INTERVAL '1 hour';
```

### Failure Rate

```sql
-- Failed events in last hour
SELECT 
  event_type,
  COUNT(*) as failures
FROM event_outbox
WHERE status = 'failed'
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY event_type;
```

---

## Testing Failure Scenarios

### Test 1: Temporary Failure (Succeeds on Retry)

```bash
# Create policy with simulateFailure
curl -X POST http://localhost:3001/api/policies \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Policy",
    "rules": {"test": true},
    "simulateFailure": true
  }'

# Watch logs for retry attempts
tail -f logs/app.log | grep "Simulating failure"

# Verify eventual success
SELECT * FROM audit_log WHERE entity_id = '<policy-id>';
```

### Test 2: Permanent Failure (Max Retries)

Modify `PolicyAuditHandler` to always fail:

```typescript
if (shouldSimulateFailure) {
  throw new Error('Permanent failure for testing');
}
```

Observe dead-letter behavior.

### Test 3: Idempotency

Manually insert duplicate outbox entry:

```sql
INSERT INTO event_outbox (event_id, event_type, aggregate_type, aggregate_id, payload)
SELECT event_id, event_type, aggregate_type, aggregate_id, payload
FROM event_outbox
WHERE id = '<existing-outbox-id>';
```

Verify only one audit log created.

---

## Summary

**Triggering Failures:**
- Use `simulateFailure` metadata flag
- Modify handler to throw errors
- Simulate database failures

**Observing Failures:**
- Application logs (structured JSON)
- `event_outbox` table (retry count, status)
- BullMQ queue (failed jobs)
- `processed_events` table (idempotency)

**Investigating:**
1. Find event in `domain_events`
2. Check outbox status
3. Review worker logs
4. Verify audit log created
5. Check idempotency tracking

**Resolving:**
- Automatic retries (up to 3 attempts)
- Manual retry (reset outbox status)
- Dead-letter inspection and reprocessing
