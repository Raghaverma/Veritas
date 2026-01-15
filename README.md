# Hyper Nest

Hyper Nest is a NestJS backend template for hyper growth.
It is a battle tested framework that we use at hypeliv ourselves to ship prod ready code!

## 🚀 Tech Stack

- **Framework:** [NestJS](https://nestjs.com/)
- **Database:** [PostgreSQL](https://www.postgresql.org/) with [Supabase](https://supabase.com/)
- **ORM:** [Drizzle ORM](https://orm.drizzle.team/)
- **Queues:** [BullMQ](https://docs.bullmq.io/) + [Redis](https://redis.io/)
- **Authentication:** [Firebase Admin SDK](https://firebase.google.com/docs/admin)
- **Monitoring:** [Sentry](https://sentry.io/)
- **Security:** Helmet, NestJS Throttler (Rate Limiting)

## 📋 Prerequisites

- Node.js (v20+)
- npm / yarn / pnpm
- PostgreSQL instance (Supabase recommended)
- Redis instance
- Firebase project credentials

## ⚙️ Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd hyper-nest
   ```

2. Install dependencies:

   ```bash
   yarn install
   ```

3. Setup environment variables:
   Copy `.env.sample` to `.env` and fill in the required values.

   ```bash
   cp .env.sample .env
   ```

## 🛠️ Environment Variables

The application uses `class-validator` for environment variable validation at startup. Ensure the following are set:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | Application port | `3000` |
| `NODE_ENV` | Application environment | `development` |
| `DB_URL` | PostgreSQL connection string | |
| `CACHE_HOST` | Redis host | |
| `CACHE_PORT` | Redis port | `6379` |
| `IS_REDIS_CLUSTER` | Use Redis Cluster mode | `false` |
| `USE_TLS` | Enable TLS for Redis | `false` |
| `FIREBASE_CLIENT_EMAIL`| Firebase service account email | |
| `FIREBASE_PRIVATE_KEY` | Firebase service account private key | |
| `FIREBASE_PROJECT_ID` | Firebase project ID | |
| `SENTRY_DSN` | Sentry DSN | |

## 🏗️ Commands

### Development

```bash
# start in watch mode
yarn start:dev

# debugging
yarn start:debug
```

### Database (Drizzle)

```bash
# generate migrations
yarn generate

# run migrations
yarn migrate
```

### Production

```bash
# build the application
yarn build

# run production build
yarn start:prod
```

### Testing

```bash
# unit tests
yarn test

# test coverage
yarn test:cov
```

## 🏗️ Architecture & Best Practices

- **Modular Architecture:** All code follows a modular structure.
- **Layered Responsibility:**
  - `API` -> `Controller` -> `Service` -> `Repository`
  - Logic lives in **Services**.
  - Data access lives in **Repositories**.
- **Third-party Integrations:** All external APIs (Firebase, etc.) are isolated in `/src/integrations`.
- **Validation:** All incoming requests are validated using `ValidationPipe`.
- **Security:**
  - `Helmet` is used for security headers.
  - `Throttler` is implemented for rate-limiting.

## 🚢 Deployment & CI/CD

### GitHub Actions

A CI workflow is configured in `.github/workflows/ci.yml` that automatically:

- Lints the code.
- Runs unit tests.
- Verifies the build.

This ensures that only stable code is pushed to the main branch.

### Railway Deployment

The backend is optimized for deployment on **Railway** (AWS works too).

- The application will automatically pick up environment variables from Railway's settings.
- Ensure all secrets defined in `src/config/index.ts` are present in the Railway environment.
- **Database:** Hosted on Supabase.
- **Background Jobs:** Powered by BullMQ (requires Redis).
- **Sentry:** Integrated for error tracking and performance monitoring.

### 🛠️ Sentry Setup

1. **Create Sentry Project:** Go to [Sentry.io](https://sentry.io/) and create a new NestJS project.
2. **Configure DSN:** Copy your DSN and add it to your `.env` file:

   ```env
   SENTRY_DSN=your_sentry_dsn_here
   ```

3. **Sourcemaps (Optional but recommended):**
   - Install Sentry CLI: `npm install -g @sentry/cli`
   - Update the `sentry:sourcemaps` script in `package.json` with your project and organization slugs:

     ```json
     "sentry:sourcemaps": "sentry-cli sourcemaps inject --project <your-project> ./dist && sentry-cli sourcemaps upload --project <your-project> ./dist"
     ```

   - Ensure `SENTRY_AUTH_TOKEN` is set in your environment for uploading sourcemaps.

### 🚫 How to Remove Sentry

If you don't want to use Sentry, follow these steps:

1. **Remove Initialization:** In `src/main.ts`, delete the line `import './instrument';`.
2. **Remove from AppModule:** In `src/app.module.ts`, remove `SentryModule.forRoot()` from the `imports` array and its corresponding import at the top.
3. **Update Build Script:** In `package.json`, change the `build` script to:

   ```json
   "build": "nest build"
   ```
4. **Delete Config:** Remove `src/instrument.ts`.
5. **Cleanup Dependencies:** (Optional) Uninstall `@sentry/nestjs` and `@sentry/cli`.
6. **Update Error Filter:** In `src/helpers/filters/all-exceptions.filter.ts`, remove Sentry imports and the `Sentry.captureException(exception)` call.

## 🔥 Firebase Setup

To get your Firebase service account credentials:

1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Select your project.
3. Click the ⚙️ (Gear icon) next to **Project Overview** and select **Project settings**.
4. Go to the **Service accounts** tab.
5. Click **Generate new private key**, then click **Generate key** in the modal.
6. A JSON file will download. Extract the following values for your `.env`:
   - `project_id` -> `FIREBASE_PROJECT_ID`
   - `private_key` -> `FIREBASE_PRIVATE_KEY`
   - `client_email` -> `FIREBASE_CLIENT_EMAIL`

## 📄 License

Hyper Nest is [UNLICENSED](LICENSE).
