const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseUuid(value: FormDataEntryValue | null, fieldName: string) {
  const parsed = String(value ?? "").trim();
  if (!uuidPattern.test(parsed)) throw new Error(`${fieldName} is invalid.`);
  return parsed;
}

export function parseEmail(value: FormDataEntryValue | null) {
  const email = String(value ?? "").trim().toLowerCase();
  if (email.length > 254 || !emailPattern.test(email)) throw new Error("Enter a valid email address.");
  return email;
}

export function parseOptionalName(value: FormDataEntryValue | null, label: string) {
  const name = String(value ?? "").trim();
  if (name.length > 80) throw new Error(`${label} must be 80 characters or fewer.`);
  return name;
}

export function parseMembershipStatus(value: FormDataEntryValue | null) {
  const status = String(value ?? "");
  if (!(["active", "inactive", "suspended"] as const).includes(status as "active" | "inactive" | "suspended")) {
    throw new Error("Membership status is invalid.");
  }
  return status as "active" | "inactive" | "suspended";
}

export function parseProfileStatus(value: FormDataEntryValue | null) {
  const status = String(value ?? "");
  if (!(["active", "inactive", "suspended"] as const).includes(status as "active" | "inactive" | "suspended")) {
    throw new Error("Profile status is invalid.");
  }
  return status as "active" | "inactive" | "suspended";
}
