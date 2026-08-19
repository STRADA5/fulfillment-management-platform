import { AuthCard } from "@/components/auth/auth-card";
import { AuthForm } from "@/components/auth/auth-form";
import { resetPasswordAction } from "@/lib/auth/actions";

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Choose a new password" description="Use at least 12 characters and avoid passwords used elsewhere.">
      <AuthForm
        action={resetPasswordAction}
        submitLabel="Update password"
        fields={[
          { name: "password", label: "New password", type: "password", autoComplete: "new-password", minLength: 12 },
          { name: "passwordConfirmation", label: "Confirm new password", type: "password", autoComplete: "new-password", minLength: 12 },
        ]}
      />
    </AuthCard>
  );
}
