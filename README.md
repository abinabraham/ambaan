# Ambaan — Income & Expense Tracker

Multi-currency (AED, INR, USD) personal finance app: accounts, transactions, budgets, savings goals,
recurring bills/income, analytics and rule-based financial advice.

| Layer | Technology |
| --- | --- |
| Web frontend | React 19 + Vite + TypeScript, Ant Design, Recharts, TanStack Query |
| Backend | Python 3.12, Django, Django REST Framework, Simple JWT, drf-spectacular |
| Database | Supabase PostgreSQL (SQLite locally when `DATABASE_URL` is unset) |
| Receipts | Supabase Storage (local `media/` when Supabase is not configured) |
| Hosting | Render (API), Cloudflare Pages (web) |

## Project layout

```
backend/
  config/                Django settings and URL routing
  apps/
    core/                UUID base models, currencies, exchange rates, audit log, Supabase storage
    accounts/            Custom email user, register/login/logout (JWT), profile, password
    finance_accounts/    Bank, cash, wallet, credit card (balances computed from transactions)
    categories/          Income/expense categories (defaults seeded on registration)
    transactions/        Income, expense and transfers (incl. cross-currency), receipts, CSV export
    budgets/             Monthly overall and per-category budgets with utilisation
    savings/             Savings goals and contributions
    recurring/           Recurring bills/income, scheduler, reminders
    analytics/           Calculation engine, dashboard, monthly/yearly reports, advice rules
    notifications/       Budget alerts, bill reminders, goal achievements
frontend/
  src/api/               Axios client (JWT refresh), types, React Query hooks
  src/pages/             Dashboard, Transactions, Accounts, Budgets, Savings, Recurring, Analytics, ...
```

## Financial rules built in

1. UUID primary keys on every business record; every record belongs to a user and all queries are user-scoped.
2. `DecimalField(14, 2)` for money; no floats in calculations.
3. Every account has a currency; transactions inherit it. Reports run inside one currency.
4. Cross-currency figures are only produced with exchange rates you store (Settings → Exchange rates).
   Missing rates are reported, never guessed.
5. `transaction_date` is separate from `created_at`/`updated_at`.
6. Transfers move money between accounts and are never counted as income or expense. Cross-currency
   transfers store both amounts and the exchange rate.
7. Every create/update/delete of financial records writes an `AuditLog` entry with before/after snapshots.

## Local development

```bash
# Backend
cd backend
python3.12 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # set DJANGO_DEBUG=True for local dev
python manage.py migrate
python manage.py seed_demo      # optional: demo@ambaan.app / Demo-pass-2026
python manage.py runserver      # http://localhost:8000/api/docs/ for Swagger

# Frontend
cd frontend
cp .env.example .env            # VITE_API_URL=http://localhost:8000/api
npm install
npm run dev                     # http://localhost:5173
```

Run backend tests with `python manage.py test apps`.

## API

All endpoints are under `/api/`. Interactive docs: `/api/docs/`, OpenAPI schema: `/api/schema/`.

| Module | Endpoint |
| --- | --- |
| Register / login / refresh / logout | `/api/auth/register/`, `/api/auth/login/`, `/api/auth/refresh/`, `/api/auth/logout/` |
| Profile / password | `/api/accounts/profile/`, `/api/accounts/password/` |
| Finance accounts | `/api/finance-accounts/` |
| Categories | `/api/categories/` |
| Transactions | `/api/transactions/`, `…/export/`, `…/{id}/receipt/` |
| Budgets | `/api/budgets/`, `/api/budgets/copy/` |
| Savings goals | `/api/savings/`, `…/{id}/contributions/` |
| Recurring | `/api/recurring/`, `…/upcoming/`, `…/process/`, `…/{id}/post/`, `…/{id}/skip/` |
| Dashboard | `/api/dashboard/?currency=AED` |
| Analytics | `/api/analytics/monthly/?year=&month=&currency=`, `/api/analytics/yearly/?year=&currency=` |
| AI advice | `/api/analytics/ai-advice/?currency=` |
| Notifications | `/api/notifications/`, `…/unread_count/`, `…/mark_all_read/` |
| Exchange rates / audit log | `/api/exchange-rates/`, `/api/audit-log/` |

## Deployment

```
https://ambaan-web.pages.dev      ->  Cloudflare Pages  (frontend/, static React build)
https://ambaan-api.onrender.com   ->  Render            (backend/, Django + gunicorn, Singapore)
                                      Supabase          (PostgreSQL + private "receipts" Storage bucket, ap-northeast-2)
```

### 1. Supabase
1. Create a project. Keep it close to the Render region in `render.yaml`.
2. **Connect → Session pooler**: copy the URI, insert the database password and append `?sslmode=require`.
   This is `DATABASE_URL`. Use the session pooler (IPv4), not the direct connection, which is IPv6-only.
3. **Project Settings → API**: copy the Project URL (`SUPABASE_URL`) and the `service_role` key
   (`SUPABASE_SERVICE_ROLE_KEY`). These go to the backend only, never the frontend.
   The `receipts` bucket is created as private by `build.sh`; receipts are served through short-lived signed URLs.

### 2. Render (API)
1. Push this repo to GitHub.
2. Render → **New → Blueprint** → select the repo. `render.yaml` creates `ambaan-api`.
3. Fill in the secret values when prompted: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `DJANGO_SUPERUSER_PASSWORD` (the admin login for `DJANGO_SUPERUSER_EMAIL`).
4. `build.sh` installs dependencies, runs migrations, creates the Storage bucket and the admin user.
   Health check: `/health/`. Recurring items are processed for each user when they open the app.

### 3. Cloudflare Pages (frontend)
Either connect the GitHub repo (Workers & Pages → Create → Pages → Connect to Git; root directory `frontend`,
build command `npm run build`, output `dist`), or deploy from this machine:

```bash
cd frontend
npx wrangler login
npx wrangler pages project create ambaan-web --production-branch main
npm run build && npx wrangler pages deploy dist
```

`.env.production` points the build at `https://ambaan-api.onrender.com/api`; `public/_redirects` handles SPA routing.
Redeploy with `npm run deploy`.

### 4. Custom domain (optional)
With a domain you own on Cloudflare DNS, e.g. `example.com`:

| Name  | Type  | Target                    | Proxy    |
|-------|-------|---------------------------|----------|
| `app` | CNAME | `ambaan-web.pages.dev`    | Proxied  |
| `api` | CNAME | `ambaan-api.onrender.com` | DNS only |

Then add `app.example.com` under the Pages project's Custom domains and `api.example.com` under the Render
service's Custom Domains, update `DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS` in
`render.yaml` and `VITE_API_URL` in `frontend/.env.production`.

## Roadmap
- React Native mobile app reusing `src/api` types and hooks.
- `households` app for shared budgets between family members.
- LLM layer on top of `/api/analytics/ai-advice/` (the rule engine already produces the metrics to send).
