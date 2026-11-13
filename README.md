# PLMun Business Center

A web-based ordering, point-of-sale (POS), inventory, and management system built for the Pamantasan ng Lungsod ng Muntinlupa Business Center.

## Tech Stack

**Frontend**
- React 19
- TypeScript
- Vite 8
- Tailwind CSS 4

**Backend**
- Supabase Auth
- Supabase PostgreSQL
- Supabase Edge Functions
- Hono

## Architecture

The application uses a React frontend connected to a Supabase backend through HTTP requests handled by a Hono-based Edge Function.

- **Authentication:** Supabase Auth handles user authentication.
- **Database:** PostgreSQL stores application data.
- **API:** Hono handles backend requests, business logic, and server-side role validation.
- **Authorization:** Row Level Security (RLS) and server-side role checks protect application data and operations.
- **Notifications:** Persistent, user-specific notifications are stored in PostgreSQL.

## Core Modules

- **Student:** Product catalog, cart, checkout, order tracking, and order history.
- **Staff:** Online order processing, POS transactions, and inventory handling.
- **Admin:** Product, inventory, user, transaction, and report management.

## Database

Database schemas and migrations are maintained in `supabase/migrations/`.

| Table | Description |
|---|---|
| `profiles` | User profiles and role assignments |
| `products` | Products, services, pricing, and stock |
| `orders` | Student online orders |
| `order_items` | Items associated with online orders |
| `transactions` | Completed POS and online sales |
| `transaction_items` | Items associated with transactions |
| `inventory_movements` | Inventory adjustment history |
| `order_status_history` | Order status transition history |
| `notifications` | Persistent in-app notifications |

## Getting Started

### Requirements

- Node.js
- pnpm
- Access to the connected Supabase project

### Installation

```bash
pnpm install
```

### Development

```bash
pnpm dev
```

### Validation

```bash
pnpm format --write src
pnpm exec tsc --noEmit
pnpm build
```

## Supabase Setup

Authenticate and link your Supabase project:

```bash
pnpm dlx supabase@latest login
pnpm dlx supabase@latest link --project-ref <your-project-ref>
```

Apply database migrations:

```bash
pnpm dlx supabase@latest db push --remote --yes
```

Deploy the Edge Function:

```bash
pnpm dlx supabase@latest functions deploy server --use-api --yes
```

## Deployment

Build the frontend:

```bash
pnpm build
```

Deploy the generated `dist/` directory to your configured hosting provider.

For Vercel deployments, pushing to the connected production branch triggers the configured deployment.

**Note:** Frontend deployment does not automatically apply database migrations or deploy Edge Functions. These must be deployed separately.

## Environment & Security

- Supabase project configuration is maintained in `utils/supabase/info.tsx`.
- Service-role credentials must only be configured in the Supabase Edge Function environment.
- Never expose service-role keys or other privileged credentials in frontend code.

## Current Limitations

- Online orders use pay-at-pickup; no online payment gateway is integrated.
- Automated email notifications are not currently implemented.