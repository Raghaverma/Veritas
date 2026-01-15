# Veritas

![CI](https://github.com/Raghaverma/Veritas/actions/workflows/ci.yml/badge.svg)
![Version](https://img.shields.io/badge/version-0.0.1-blue.svg?cacheSeconds=2592000)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![NestJS](https://img.shields.io/badge/nestjs-11.x-red.svg)


**A production-ready NestJS backend template for hyper-growth applications.**

Veritas is a battle-tested, enterprise-grade backend framework that implements **Domain-Driven Design (DDD)**, **Event Sourcing**, and **CQRS patterns**. Built by the hypeliv team, it's designed to ship production-ready code from day one.

---

## 🎯 What Makes This Different

Unlike typical CRUD templates, Veritas implements sophisticated architectural patterns:

- **Domain-Driven Design (DDD)** - Business logic encapsulated in Aggregates with strong invariants
- **Event Sourcing** - Complete audit trail through domain events
- **CQRS** - Separate command and query responsibilities for optimal performance
- **Event-Driven Architecture** - Asynchronous processing with BullMQ queues
- **Optimistic Concurrency Control** - Version-based conflict resolution
- **Transactional Outbox Pattern** - Guaranteed event delivery

### Architecture Flow

```
HTTP Request → Auth → Command → Domain → Event → Queue → Worker → Audit → Query
```

---

## 🚀 Tech Stack

| Component | Technology |
|-----------|-----------|
| **Framework** | [NestJS](https://nestjs.com/) |
| **Database** | [PostgreSQL](https://www.postgresql.org/) with [Supabase](https://supabase.com/) |
| **ORM** | [Drizzle ORM](https://orm.drizzle.team/) |
| **Queues** | [BullMQ](https://docs.bullmq.io/) + [Redis](https://redis.io/) |
| **Authentication** | [Firebase Admin SDK](https://firebase.google.com/docs/admin) |
| **Monitoring** | [Sentry](https://sentry.io/) |
| **Security** | Helmet, NestJS Throttler (Rate Limiting) |
| **Validation** | class-validator, class-transformer |

---

## 📋 Prerequisites

- **Node.js** (v20+)
- **npm** / **yarn** / **pnpm**
- **PostgreSQL** instance (Supabase recommended)
- **Redis** instance
- **Firebase** project credentials

---

## ⚙️ Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/Raghaverma/Veritas.git
cd veritas
yarn install
```

### 2. Environment Setup

Copy the sample environment file and configure your credentials:

```bash
cp .env.sample .env
```

### 3. Configure Environment Variables

See the [Environment Variables](#-environment-variables) section below for required values.

### 4. Run Database Migrations

```bash
yarn generate  # Generate migrations
yarn migrate   # Apply migrations
```

### 5. Start Development Server

```bash
yarn start:dev
```

The server will start on `http://localhost:3001` (or your configured `PORT`).

---

## 🛠️ Environment Variables

The application uses `class-validator` for environment variable validation at startup.

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | Application port | `3001` |
| `NODE_ENV` | Application environment | `development` |
| `DB_URL` | PostgreSQL connection string | *required* |
| `CACHE_HOST` | Redis host | *required* |
| `CACHE_PORT` | Redis port | `6379` |
| `CACHE_PASSWORD` | Redis password | |
| `IS_REDIS_CLUSTER` | Use Redis Cluster mode | `false` |
| `USE_TLS` | Enable TLS for Redis | `false` |
| `FIREBASE_CLIENT_EMAIL`| Firebase service account email | *required* |
| `FIREBASE_PRIVATE_KEY` | Firebase service account private key | *required* |
| `FIREBASE_PROJECT_ID` | Firebase project ID | *required* |
| `SENTRY_DSN` | Sentry DSN for error tracking | |

---

## 🏗️ Architecture Overview

### Layered Architecture

```
src/
├── api/              # HTTP Controllers (REST endpoints)
├── commands/         # Command bus & handlers (write operations)
├── domain/           # Business logic
│   ├── aggregates/   # Domain aggregates (business rules)
│   ├── events/       # Domain events
│   ├── policies/     # Business policies
│   └── value-objects/ # Immutable value objects
├── event-bus/        # Event publishing & outbox pattern
├── workers/          # Background job processors
├── read-models/      # Query-optimized data access (CQRS read side)
├── repositories/     # Data persistence layer
├── audit/            # Audit logging
├── observability/    # Logging, tracing, monitoring
├── integrations/     # External services (Firebase, etc.)
├── helpers/          # Utilities (Drizzle, Cache, Filters)
└── modules/          # Feature modules (e.g., Users)
```

### Request Flow

1. **API Layer** - Controllers validate and route requests
2. **Command Layer** - Commands encapsulate write operations
3. **Domain Layer** - Aggregates enforce business rules and emit events
4. **Event Layer** - Events are stored in outbox and published
5. **Queue Layer** - BullMQ processes events asynchronously
6. **Worker Layer** - Background jobs handle side effects
7. **Audit Layer** - Complete event log for compliance
8. **Query Layer** - Read models provide optimized queries

### Key Design Patterns

- **Aggregate Pattern** - Encapsulates business logic with transactional boundaries
- **Command Pattern** - Separates request from execution
- **Event Sourcing** - State changes captured as immutable events
- **Outbox Pattern** - Ensures reliable event delivery
- **Repository Pattern** - Abstracts data access
- **Middleware Chain** - Logging, authentication, rate limiting

---

## 🔥 Key Features

### 1. Domain Aggregates

Business logic is encapsulated in aggregates that enforce invariants:

```typescript
// Example: Creating an action with business rules
const result = ActionAggregate.create(
  userId,
  name,
  type,
  description,
  metadata,
  eventMetadata
);

if (result.success) {
  // Events are automatically emitted
  const events = result.data;
}
```

### 2. Event-Driven Architecture

All state changes emit domain events for:
- Audit trails
- Asynchronous processing
- System integration
- Analytics

### 3. Background Job Processing

BullMQ queues handle:
- Email notifications
- Data processing
- Third-party integrations
- Scheduled tasks

### 4. Built-in Security

- **Helmet** - Security headers
- **Throttler** - Rate limiting
- **Firebase Auth** - JWT validation
- **Validation Pipes** - Request validation

### 5. Observability

- **Sentry** - Error tracking and performance monitoring
- **Health Checks** - `/health` endpoint with database checks
- **Structured Logging** - Request/response logging
- **Swagger Docs** - Auto-generated API documentation at `/doc`

---

## 📝 Available Commands

### Development

```bash
# Start in watch mode
yarn start:dev

# Start with debugging
yarn start:debug

# Format code
yarn format

# Lint and fix
yarn lint
```

### Database (Drizzle)

```bash
# Generate migrations from schema changes
yarn generate

# Run pending migrations
yarn migrate
```

### Production

```bash
# Build the application
yarn build

# Run production build
yarn start:prod
```

### Testing

```bash
# Run unit tests
yarn test

# Run tests in watch mode
yarn test:watch

# Generate test coverage
yarn test:cov

# Run e2e tests
yarn test:e2e
```

---

## 🚢 Deployment

### Railway (Recommended)

Veritas is optimized for deployment on **Railway**:

1. Connect your GitHub repository to Railway
2. Configure environment variables in Railway dashboard
3. Railway will automatically detect and build the NestJS app
4. Database: Use Supabase for PostgreSQL
5. Cache: Add Redis plugin in Railway

### AWS / Other Platforms

The application is containerizable and can run on any Node.js hosting platform:

- Ensure all environment variables are set
- Run `yarn build` to compile TypeScript
- Start with `yarn start:prod`
- Ensure Redis and PostgreSQL are accessible

---

## 🔧 Configuration Guides

### Firebase Setup

1. Open the [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click ⚙️ (Gear icon) → **Project settings**
4. Go to **Service accounts** tab
5. Click **Generate new private key**
6. Extract values from the downloaded JSON:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `private_key` → `FIREBASE_PRIVATE_KEY`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`

### Sentry Setup

1. Create a project at [Sentry.io](https://sentry.io/)
2. Copy your DSN and add to `.env`:
   ```env
   SENTRY_DSN=your_sentry_dsn_here
   ```

3. **(Optional) Enable Sourcemaps:**
   ```bash
   npm install -g @sentry/cli
   ```
   
   Update `package.json`:
   ```json
   "sentry:sourcemaps": "sentry-cli sourcemaps inject --project <your-project> ./dist && sentry-cli sourcemaps upload --project <your-project> ./dist"
   ```
   
   Set `SENTRY_AUTH_TOKEN` in your environment.

### Removing Sentry (Optional)

If you don't need Sentry:

1. Remove `import './instrument';` from `src/main.ts`
2. Remove `SentryModule.forRoot()` from `src/app.module.ts`
3. Update build script in `package.json`:
   ```json
   "build": "nest build"
   ```
4. Delete `src/instrument.ts`
5. Remove Sentry calls from `src/helpers/filters/all-exceptions.filter.ts`
6. (Optional) Uninstall: `yarn remove @sentry/nestjs @sentry/cli`

---

## 🏛️ Best Practices

### Modular Architecture

- All code follows a **modular structure**
- Each feature is self-contained in its own module
- Shared logic lives in `helpers/` and `shared/`

### Layered Responsibility

```
API → Controller → Service → Repository
```

- **Controllers** - Handle HTTP, validate input
- **Services** - Orchestrate business logic
- **Repositories** - Data access only

### Domain Logic

- Business rules live in **Aggregates**
- Use **Value Objects** for immutable data
- Emit **Domain Events** for state changes

### Third-Party Integrations

- All external APIs isolated in `src/integrations/`
- Use dependency injection for testability
- Handle failures gracefully

### Validation

- All incoming requests validated using `ValidationPipe`
- Use DTOs with `class-validator` decorators
- Fail fast with clear error messages

---

## 🧪 Testing Strategy

### Unit Tests

- Test aggregates in isolation
- Mock repositories and external services
- Focus on business rule validation

### Integration Tests

- Test command handlers with real database
- Verify event emission
- Test worker processors

### E2E Tests

- Test complete request flows
- Verify authentication and authorization
- Test error scenarios

---

## 🚦 CI/CD

A GitHub Actions workflow (`.github/workflows/ci.yml`) automatically:

- ✅ Lints the code
- ✅ Runs unit tests
- ✅ Verifies the build
- ✅ Ensures code quality before merging

---

## 📚 API Documentation

Once the server is running, visit:

- **Swagger UI**: `http://localhost:3001/doc`
- **Health Check**: `http://localhost:3001/health`

---

## 🎓 Learning Resources

### Domain-Driven Design
- [Domain-Driven Design by Eric Evans](https://www.domainlanguage.com/ddd/)
- [Implementing Domain-Driven Design by Vaughn Vernon](https://vaughnvernon.com/)

### Event Sourcing & CQRS
- [CQRS Journey by Microsoft](https://docs.microsoft.com/en-us/previous-versions/msp-n-p/jj554200(v=pandp.10))
- [Event Sourcing Pattern](https://martinfowler.com/eaaDev/EventSourcing.html)

### NestJS
- [Official NestJS Documentation](https://docs.nestjs.com/)
- [NestJS Fundamentals Course](https://courses.nestjs.com/)

---

## 🤝 Contributing

This is a template repository. Fork it and customize it for your needs!

---

## 📄 License

Veritas is [MIT licensed](LICENSE).

---

## 💬 Support

Built with ❤️ by the hypeliv team for teams that need enterprise-grade backends from day one.

For questions or issues, please refer to the documentation or create an issue in the repository.
