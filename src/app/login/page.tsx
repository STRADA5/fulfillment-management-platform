import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { AuthForm } from "@/components/auth/auth-form";
import { loginAction } from "@/lib/auth/actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await searchParams;
  return (
    <AuthCard title="Sign in" description="Use the account provided by your platform administrator.">
      {params.error ? <p role="alert" className="mb-5 text-sm text-red-700">The sign-in link was invalid or expired.</p> : null}
      <AuthForm
        action={loginAction}
        submitLabel="Sign in"
        hiddenFields={{ next: params.next ?? "/dashboard" }}
        fields={[
          { name: "email", label: "Email address", type: "email", autoComplete: "email" },
          { name: "password", label: "Password", type: "password", autoComplete: "current-password" },
        ]}
      />
      <Link href="/forgot-password" className="mt-5 block text-center text-sm font-medium text-slate-700 hover:text-slate-950">
        Forgot your password?
      </Link>
    </AuthCard>
  );
}
