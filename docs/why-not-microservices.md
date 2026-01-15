# Why Not Microservices?

**Engineering Decision Record**

**Date**: 2026-01-15  
**Status**: Accepted  
**Decision**: Veritas will remain a modular monolith. Microservices are explicitly rejected at this stage.

---

## Context

Veritas is an event-driven backend system implementing DDD/CQRS patterns. As the system grows, the question arises: should we split into microservices?

This document explains why a **modular monolith** is the correct architecture for Veritas today, what boundaries already exist, and what signals would justify future extraction.

---

## Decision

**Veritas will remain a modular monolith.**

We explicitly reject microservices for the following reasons:

### 1. Complexity Without Benefit

**Microservices add:**
- Distributed system complexity (network failures, partial failures, timeouts)
- Operational overhead (multiple deployments, monitoring, log aggregation)
- Data consistency challenges (distributed transactions, sagas)
- Development friction (service discovery, API versioning, contract testing)

**What we gain:**
- Independent deployment (not needed yet - single team, coordinated releases)
- Technology diversity (not needed - TypeScript/NestJS works for all domains)
- Team autonomy (not needed - single team owns entire system)
- Independent scaling (not needed - all aggregates have similar load)

**Verdict**: Cost >> Benefit

### 2. Premature Optimization

**Current state:**
- Single development team
- Shared domain knowledge
- Coordinated release cycles
- Similar scaling characteristics across aggregates

**Microservices optimize for:**
- Multiple independent teams
- Different deployment schedules
- Heterogeneous technology stacks
- Vastly different scaling needs

**We don't have these problems yet.** Solving them preemptively adds complexity without addressing real pain.

### 3. Monolith != Big Ball of Mud

Veritas is **modular**:
- Clear aggregate boundaries (Action, Policy, User)
- Separate modules with defined interfaces
- Event-driven communication between aggregates
- No shared mutable state across aggregates

**The boundaries exist.** They're just not network boundaries.

If we later extract services, the hard work (domain modeling, event contracts) is already done. The extraction becomes a deployment decision, not an architectural overhaul.

---

## Existing Boundaries

Veritas already has strong internal boundaries that would map cleanly to services if needed:

### Aggregate Boundaries

Each aggregate is a **transactional boundary**:

| Aggregate | Responsibility | Events Emitted |
|-----------|---------------|----------------|
| **Action** | Track user actions/operations | ActionCreated, ActionCompleted, ActionCancelled |
| **Policy** | Manage business rules | PolicyCreated, PolicyActivated, PolicyRevoked |
| **User** | User identity and profile | UserCreated, UserUpdated |

**Key property**: Aggregates never directly call each other. Communication is via events.

### Module Boundaries

```
src/
├── modules/
│   ├── actions/      # Action aggregate + API
│   ├── policies/     # Policy aggregate + API
│   └── users/        # User aggregate + API
├── domain/
│   ├── aggregates/   # Business logic (pure, no dependencies)
│   └── events/       # Event contracts (stable interfaces)
├── commands/         # Write operations
├── read-models/      # Query operations
└── workers/          # Async event handlers
```

Each module is **loosely coupled**:
- No direct imports between aggregates
- Events are the only shared contract
- Read models are module-specific

### Data Boundaries

**Current state tables** (one per aggregate):
- `actions`
- `policies`
- `users`

**Shared infrastructure tables**:
- `domain_events` (append-only event log)
- `event_outbox` (transactional outbox)
- `audit_log` (compliance trail)
- `processed_events` (idempotency tracking)

**If we extract services:**
- Each service gets its own state table
- Shared tables become infrastructure services (Event Store, Audit Service)
- Communication via events (already implemented)

---

## What Would Justify Extraction?

Microservices are a **solution to organizational and scaling problems**, not a default architecture. Extract when:

### 1. Team Boundaries Emerge

**Signal**: Multiple teams want to work independently on different aggregates.

**Example**:
- Team A owns Actions (fintech compliance focus)
- Team B owns Policies (insurance domain focus)
- Teams have different release cycles and priorities

**Why extract?**
- Independent deployment reduces coordination overhead
- Teams can move at different speeds
- Reduces merge conflicts and code ownership disputes

**Not before**: Single team can coordinate via branches and feature flags.

### 2. Deployment Independence Required

**Signal**: Changes to one aggregate frequently break or delay others.

**Example**:
- Policy changes require extensive testing, delaying Action bug fixes
- Action has weekly releases, Policy has quarterly releases
- Rollback of Policy shouldn't affect Action

**Why extract?**
- Deploy Action without waiting for Policy
- Rollback independently
- Reduce blast radius of failures

**Not before**: Coordinated releases are manageable with good CI/CD.

### 3. Technology Divergence Needed

**Signal**: Different aggregates have fundamentally different technology needs.

**Example**:
- Policy needs graph database for rule dependencies
- Action needs time-series database for analytics
- User needs full-text search (Elasticsearch)

**Why extract?**
- Use best tool for each job
- Avoid forcing square pegs into round holes

**Not before**: PostgreSQL + Redis handles all current needs.

### 4. Severe Scale Mismatch

**Signal**: One aggregate has 1000x more traffic than others.

**Example**:
- Policy: 1M requests/day (user-facing, high traffic)
- Action: 1K requests/day (admin-only, low traffic)
- Scaling entire monolith for Policy wastes resources

**Why extract?**
- Scale Policy independently (horizontal scaling)
- Reduce infrastructure costs
- Optimize each service for its load profile

**Not before**: Vertical scaling and read replicas handle current load.

### 5. Compliance Isolation

**Signal**: Regulatory requirements demand physical separation.

**Example**:
- User data must be in EU region (GDPR)
- Financial data must be in US region (SOX)
- Cannot co-locate in same database

**Why extract?**
- Deploy services in different regions
- Meet compliance requirements
- Audit boundaries align with legal boundaries

**Not before**: Single-region deployment is compliant.

---

## Migration Path (When Needed)

If extraction becomes necessary, the path is clear:

### Phase 1: Extract Database
1. Create separate database for extracted aggregate
2. Replicate events to new database via outbox
3. Dual-write during migration
4. Verify consistency, cut over

### Phase 2: Extract API
1. Deploy aggregate as separate service
2. Route API calls via gateway
3. Internal calls become HTTP/gRPC
4. Monitor latency, rollback if needed

### Phase 3: Extract Workers
1. Move event handlers to new service
2. Subscribe to event queue
3. Maintain idempotency tracking
4. Verify audit logs still complete

**Key insight**: Because aggregates already communicate via events, extraction is a **deployment change**, not an architectural rewrite.

---

## Alternatives Considered

### Option 1: Microservices from Day 1
**Rejected**: Premature complexity. No organizational or scaling problems to solve.

### Option 2: Serverless Functions
**Rejected**: Cold starts hurt latency. Stateful workers (BullMQ) need long-running processes.

### Option 3: Shared Database Microservices
**Rejected**: Worst of both worlds. Distributed system complexity + tight coupling via database.

### Option 4: Modular Monolith (Chosen)
**Accepted**: Clear boundaries, simple deployment, easy to extract later if needed.

---

## Monitoring for Extraction Signals

Track metrics that indicate extraction might be needed:

### Team Metrics
- Merge conflict frequency
- Cross-team coordination overhead
- Deployment delays due to dependencies

### Technical Metrics
- Aggregate-specific load patterns
- Database query performance per aggregate
- Deployment frequency per module

### Business Metrics
- Team growth (1 team → 3+ teams)
- Feature velocity (slowing due to coordination)
- Compliance requirements (regional data residency)

**Review quarterly**: Are extraction signals present? If not, stay monolith.

---

## Conclusion

**Microservices are not a goal.** They're a tool for solving specific organizational and scaling problems.

Veritas has:
- ✅ Clear aggregate boundaries
- ✅ Event-driven communication
- ✅ Modular codebase
- ✅ Independent data models

What Veritas doesn't have:
- ❌ Multiple independent teams
- ❌ Heterogeneous technology needs
- ❌ Severe scaling mismatches
- ❌ Compliance isolation requirements

**Therefore**: Modular monolith is correct. Microservices are explicitly rejected until signals emerge.

**When signals emerge**: The architecture supports extraction without rewrite.

---

## References

- [Monolith First - Martin Fowler](https://martinfowler.com/bliki/MonolithFirst.html)
- [The Majestic Monolith - DHH](https://m.signalvnoise.com/the-majestic-monolith/)
- [Modular Monoliths - Simon Brown](https://www.youtube.com/watch?v=5OjqD-ow8GE)

---

**Next Review**: Q3 2026 or when team size > 10 engineers
