import { AuthCard } from "@/components/auth/auth-card";
import { AuthForm } from "@/components/auth/auth-form";
import { forgotPasswordAction } from "@/lib/auth/actions";

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Reset your password"
      description="Enter your account email. If it is recognized, we will send a secure reset link."
      footer={{ href: "/login", label: "Return to sign in" }}
    >
      <AuthForm
        action={forgotPasswordAction}
        submitLabel="Send reset link"
        fields={[{ name: "email", label: "Email address", type: "email", autoComplete: "email" }]}
      />
    </AuthCard>
  );
}
