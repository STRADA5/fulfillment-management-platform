import { ModulePlaceholder } from "@/components/ui/module-placeholder";
import { requirePermission } from "@/lib/auth/authorization";

export async function ProtectedPlaceholder({ title, permission }: { title: string; permission: string }) {
  await requirePermission(permission);
  return <ModulePlaceholder title={title} />;
}
