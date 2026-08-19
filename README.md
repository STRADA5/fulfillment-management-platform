# Fulfillment Management Platform

The foundation for a commercial multi-tenant SaaS platform that will support fulfillment operations. This repository currently contains only the application shell and shared infrastructure needed for future, staged development; fulfillment business logic and tenant features have not yet been implemented.

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
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

The application does not require these values for the current placeholder page. Supabase utilities validate them only when they are used.

> **Security warning:** Never commit secrets or populated environment files to Git. Only variables intentionally prefixed with `NEXT_PUBLIC_` may be included in browser code. Service-role keys, database passwords, and other privileged credentials must remain server-only and are not part of this foundation.

## Architecture

The project uses the Next.js `src` and App Router structure. Shared infrastructure lives under `src/lib`; Supabase browser and server clients have separate entry points to preserve the client/server security boundary. Future platform administration, tenant administration, warehouse, staff, client, product, inventory, order, fulfillment, branding, shipping, billing, messaging, notification, reporting, and integration capabilities will be designed and added as discrete modules in later stages.

The intended architecture is a multi-tenant SaaS fulfillment platform deployed on Vercel, with Supabase eventually providing PostgreSQL, authentication, storage, and backend services. Database design, tenant isolation, authorization, and Row Level Security are intentionally out of scope at this stage.
