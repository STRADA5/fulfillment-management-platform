import { ProtectedPlaceholder } from "@/components/ui/protected-placeholder";
export default function Page() { return <ProtectedPlaceholder title="Orders" permission="orders.read" />; }
