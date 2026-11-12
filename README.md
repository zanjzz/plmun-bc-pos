# PLMun Business Center

A role-based ordering, point-of-sale, inventory, and order-management system for the Pamantasan ng
Lungsod ng Muntinlupa Business Center.

## Purpose

The application connects student online ordering with counter operations and administrative
oversight. Students can order supplies and services for campus pickup, staff can process online and
walk-in transactions, and administrators can maintain products, inventory, users, and operational
records.

## Main features

- Student product and service catalogs with search and category filtering
- Student cart, checkout, order tracking, receipt confirmation, and order history
- Staff online-order review, stock-conflict handling, pickup preparation, and receipt confirmation
- Staff point-of-sale workspace with searchable inventory and stock-safe quantity controls
- Administrator product, inventory, user, reports, and transaction management
- Role-scoped in-app notifications with unread state and urgent student order alerts
- Persistent light and dark themes after authentication
- Responsive desktop, tablet, and mobile layouts

## Roles

### Student

- Browse physical products and Business Center services
- Submit and track personal orders
- Receive personal order and stock-conflict notifications
- Confirm receipt only for their own orders that are ready for pickup
- View completed and cancelled order history

### Staff

- Process walk-in sales through the POS terminal
- Review online orders and resolve stock conflicts
- Mark confirmed orders ready for pickup
- Confirm that ready orders were handed to students
- Receive operational, order, and inventory notifications

### Administrator

- Review Business Center activity from the dashboard
- Manage products, prices, descriptions, and availability
- Manage inventory and stock adjustments
- Manage user accounts, roles, and access
- Review recorded sales, transactions, and inventory movements
- Export transaction records to CSV
- Receive operational and inventory notifications

## Order lifecycle

```text
Pending review
  → Confirmed
  → Ready for pickup
  → Completed
```

An order can move to `Awaiting restock` when stock is unavailable or to `Cancelled` before
fulfillment. Inventory is deducted when staff marks an order ready for pickup. The completed status
is allowed only from `Ready for pickup`, and may be confirmed by the owning student or authorized
staff. Completion creates an online transaction record exactly once.

## Technology stack

### Frontend

- React 19
- TypeScript
- Vite 8
- Tailwind CSS 4
- Lucide React icons
- oxfmt

### Backend

- Supabase Auth
- Supabase PostgreSQL
- Supabase Edge Functions
- Hono HTTP framework
- Supabase JavaScript client

## Database schema

The schema is defined in `supabase/migrations/`.

### `profiles`

Application profile for each `auth.users` account.

- Primary key: `id`, referencing `auth.users(id)`
- Important fields: `email`, `full_name`, `role`, `reference`, `active`
- Roles: `student`, `staff`, `admin`

### `products`

Physical products and services offered by the Business Center.

- Important fields: `name`, `category`, `description`, `image`, `price`, `stock`, `active`
- Referenced by order items, transaction items, and inventory movements

### `orders`

Student online orders.

- Primary key: `id`
- Unique public reference: `order_number`
- `user_id` references `profiles(id)`
- Important fields: `status`, `status_message`, `total`, `pickup_date`, `pickup_window`, `notes`

### `order_items`

Immutable item details recorded for an order.

- `order_id` references `orders(id)` with cascade deletion
- `product_id` references `products(id)`
- Important fields: `product_name`, `quantity`, `unit_price`

### `transactions`

Completed walk-in and online sales.

- Unique public reference: `transaction_number`
- `staff_id` optionally references `profiles(id)`
- `order_id` optionally references `orders(id)`
- Important fields: `source`, `total`, `created_at`

### `transaction_items`

Items recorded for a completed transaction.

- `transaction_id` references `transactions(id)` with cascade deletion
- `product_id` references `products(id)`
- Important fields: `product_name`, `quantity`, `unit_price`

### `inventory_movements`

Audit trail for inventory changes.

- `product_id` references `products(id)`
- `actor_id` optionally references `profiles(id)`
- Important fields: `movement_type`, `quantity_change`, `stock_after`, `reference_type`,
  `reference_id`, `note`

### `order_status_history`

Audit trail for every order status transition.

- `order_id` references `orders(id)` with cascade deletion
- `changed_by` optionally references `profiles(id)`
- Important fields: `from_status`, `to_status`, `message`, `created_at`

### `notifications`

Persistent, per-user in-app notifications.

- `recipient_id` references `profiles(id)` with cascade deletion
- Important fields: `recipient_role`, `event_key`, `type`, `title`, `message`, `action_page`,
  `entity_type`, `entity_id`, `metadata`, `read_at`
- Unique `(recipient_id, event_key)` prevents duplicate event delivery

Row-level security is enabled on application tables. The Edge Function uses authenticated requests
and server-side role checks for data access and mutations.

## Local setup

Requirements:

- Node.js and pnpm versions from `.mise.toml`
- Access to the connected Supabase project for backend deployment

Install dependencies:

```sh
pnpm install
```

Run the development server outside Figma Make:

```sh
pnpm dev
```

Run validation:

```sh
pnpm format --write src
pnpm exec tsc --noEmit
pnpm build
```

## Supabase deployment

Authenticate and link the target project:

```sh
pnpm dlx supabase@latest login
pnpm dlx supabase@latest link --project-ref <your-project-ref>
```

Apply database migrations:

```sh
pnpm dlx supabase@latest db push --remote --yes
```

Deploy the Edge Function:

```sh
pnpm dlx supabase@latest functions deploy server --use-api --yes
```

Publishing the frontend does not automatically apply database migrations or deploy Edge Functions.
The notification and reports features require the latest migrations and server function.

## Frontend deployment

Create a production build:

```sh
pnpm build
```

Deploy the generated `dist/` directory to the configured static host. If Vercel is connected to the
GitHub repository, pushing the production branch triggers the configured deployment.

## Current integration notes

- Automated email delivery is intentionally deferred.
- Student online orders use pay-at-pickup. Completing a received order records the online sale; no
  external online payment gateway is currently integrated.
- Favicon assets are stored under `public/assets/`.
- Supabase project information used by the frontend is generated in `utils/supabase/info.tsx`.
- Service-role credentials must remain in the Supabase Edge Function environment and must never be
  exposed in frontend code.
