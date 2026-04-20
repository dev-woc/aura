# juice music art

Built with Next.js 15, React 19, Tailwind CSS v4, and Neon Postgres.

## Tech Stack

- **Framework:** Next.js 15 (App Router, `src/` directory)
- **UI:** React 19, Tailwind CSS v4, shadcn/ui, Lucide icons
- **Database:** Neon Postgres + Drizzle ORM
- **Auth:** Neon Auth (`@neondatabase/auth`)
- **Testing:** Vitest (unit), agent-browser (E2E)
- **Linting/Formatting:** Biome

## Getting Started

1. **Install dependencies:**

   ```bash
   npm install --legacy-peer-deps
   ```

2. **Configure environment variables:**

   ```bash
   cp .env.example .env.local
   ```

3. **Push the database schema:**

   ```bash
   npm run db:push
   ```

4. **Start the dev server:**

   ```bash
   npm run dev
   ```

> **Note:** Do not use `--turbopack` — middleware does not execute with Turbopack in Next.js 15.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run lint` | Lint with Biome |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run format` | Format with Biome |
| `npm run test` | Run unit tests (watch mode) |
| `npm run test:run` | Run unit tests once |
| `npm run test:e2e` | Run E2E tests |
| `npm run db:push` | Push schema to database |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:studio` | Open Drizzle Studio |
