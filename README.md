# Fulfillment Management Platform

The secure Phase 1 foundation for a commercial multi-tenant SaaS platform that will support fulfillment operations. It includes authentication, tenant and permission schema migrations, Row Level Security, and an authenticated application shell. Fulfillment business modules remain intentionally unimplemented.

## Technology stack

- [Next.js](https://nextjs.org/) with the App Router
- React and TypeScript
- Tailwind CSS
- ESLint
- Supabase JavaScript and server-side rendering packages (prepared, not connected)
- npm

## Local development

Requirements: a current Node.js LTS release and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

Additional quality commands:

```bash
npm run lint
npm run typecheck
npm run build
```

## Environment variables

Copy `.env.example` to `.env.local` and provide the public URL and public/anon key from the relevant Supabase project when a project is connected in a future stage.

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

The public landing page does not require these values, but authentication and protected routes do. Supabase utilities validate them when used.

> **Security warning:** Never commit secrets or populated environment files to Git. Only variables intentionally prefixed with `NEXT_PUBLIC_` may be included in browser code. Service-role keys, database passwords, and other privileged credentials must remain server-only and are not part of this foundation.

## Architecture

The project uses the Next.js `src` and App Router structure. Shared infrastructure lives under `src/lib`; Supabase browser and server clients have separate entry points to preserve the client/server security boundary. Protected routes combine server-side permission checks with database RLS. Future fulfillment capabilities will be designed and added as discrete modules in later stages.

The intended architecture is a multi-tenant SaaS fulfillment platform deployed on Vercel, with Supabase providing PostgreSQL, authentication, storage, and backend services. See [the security model](docs/security-model.md) and [migration instructions](supabase/README.md) before connecting a project.

## Authentication setup

Public self-registration is disabled at the application level. Create or invite users through a trusted Supabase administrative process. Configure the Supabase Auth site URL and allowed redirect URLs for local, preview, and production deployments so password recovery can return to `/auth/callback?next=/reset-password`.

Database changes are not applied automatically. Follow [the Supabase migration and bootstrap instructions](supabase/README.md) against a non-production project first.
