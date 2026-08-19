import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <section className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white px-8 py-14 text-center shadow-sm sm:px-14">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
          Platform status
        </p>
        <h1 className="text-balance text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
          Fulfillment Management Platform
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-pretty text-lg leading-8 text-slate-600">
          The platform foundation is operational and ready for the next stage of development.
        </p>
        <Link href="/login" className="mt-8 inline-flex rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
          Sign in
        </Link>
      </section>
    </main>
  );
}
