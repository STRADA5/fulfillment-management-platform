import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const proxy = await readFile("src/lib/supabase/proxy.ts", "utf8");
const reports = await readFile("src/app/(app)/reports/page.tsx", "utf8");
const routeRegression = await readFile("tests/phase6/salespeople-route-authorization.mjs", "utf8");

assert.match(proxy, /setAll\(cookiesToSet, headers\)/, "Supabase refresh headers must be accepted by the proxy cookie bridge.");
assert.match(proxy, /Object\.entries\(headers \?\? \{\}\)/, "Supabase refresh headers must be enumerated.");
assert.match(proxy, /response\.headers\.set\(name, value\)/, "Supabase refresh headers must be forwarded to the response.");
assert.match(proxy, /Cache-Control.*private, no-cache, no-store/, "Authenticated proxy responses must not be cached.");
assert.match(reports, /salesperson\.dashboard/, "Salesperson Reports authorization must remain enabled.");
assert.match(routeRegression, /routeChecks\.push\(\["\/reports", \/Sales reporting\//, "The authenticated salesperson route regression must traverse to Reports.");

console.log("Phase 7 session-preservation policy and salesperson Reports transition regression passed.");
