// Exact, one-use CAPTURE-CONTROL exception. No network authorization capability.
// Reviewed against phase7-preauth-authentication-metadata-capture-20260914T134556Z
// and the preserved successful authentication/dashboard evidence on the same PIN.
import { FEEDBACK_RESOURCE } from "./protected-preview-feedback-metadata.mjs";
import { sanitizePreauthenticationMetadata } from "./protected-preview-preauth-fatal-metadata.mjs";

const PRE = "PRE_AUTHENTICATION";
const receipts = new WeakMap(); // An evidence-shaped object cannot forge accounting.
const read = fn => { try { return fn(); } catch { return undefined; } };
const REQUIRED_TRUE = Object.freeze([
  "EXACT_RESOURCE_IDENTITY", "HEADERS_COMPLETE", "STRUCTURAL_HEADERS_VALID",
  "APPROVED_INITIATING_LOGIN", "APPROVED_MAIN_FRAME", "CURRENT_PAGE_LOGIN",
  "PRODUCTION_EXCLUSION_VERIFIED", "INITIATOR_CORRELATED", "INITIATOR_APPROVED_SOURCE",
  "INITIATOR_ATTRIBUTION_VERIFIED", "SINGLE_OCCURRENCE", "COUNT_COMPLETE", "SCRIPT", "BEFORE_TRANSMISSION",
]);
const REQUIRED_FALSE = Object.freeze([
  "AUTHENTICATION_PHASE", "BODY_PRESENT", "CREDENTIAL_METADATA_PRESENT", "SESSION_MATERIAL_PRESENT",
  "SESSION_REQUIRED_MATERIAL_PRESENT", "UNKNOWN_HEADERS_PRESENT", "SERVER_ACTION",
  "AUTHENTICATION_API", "SUPABASE_AUTH", "APPLICATION_API", "APPROVED_LOGIN_ACTION",
  "APPLICATION_API_REQUIRED_FOR_LOGIN", "AUTHENTICATION_RELEVANT", "NAVIGATION", "DOCUMENT",
  "FETCH_XHR", "FORM_SUBMISSION", "REDIRECT_TARGET", "SERVICE_WORKER", "PRODUCTION_TARGET",
  "INITIATOR_FOREIGN_SOURCE", "RSC_QUERY_PRESENT",
]);

export function exactPreauthenticationFacts(raw) {
  return read(() => REQUIRED_TRUE.every(key => raw[key] === true) &&
    REQUIRED_FALSE.every(key => raw[key] === false) && raw.EXACT_OCCURRENCE === 1 &&
    raw.ORIGINAL_LIFECYCLE_PHASE === PRE && raw.INITIATOR_TYPE === "SCRIPT" &&
    raw.GUARD_RULE === "ASSERT_REQUEST_EXACT_TARGET_COMPOUND" &&
    raw.FIRST_FAILED_PREDICATE === "ORIGIN_EQUALS_PIN") === true;
}

export function isPreauthenticationBlockReceipt(record, request) {
  return !!record && !!request && receipts.get(record) === request;
}

export function preauthenticationNonfatalLines(record) {
  if (!record || !receipts.has(record)) throw Error("UNVERIFIED_PREAUTH_RECEIPT");
  return Object.entries(record).map(([key, value]) =>
    `P7_PREAUTH_NONFATAL_${key}=${typeof value === "boolean" ? value ? "YES" : "NO" : value}`);
}

async function bounded(operation) {
  let timer;
  try {
    return await Promise.race([Promise.resolve().then(operation),
      new Promise((_, reject) => { timer = setTimeout(() => reject(Error("PREAUTH_METADATA_TIMEOUT")), 750); })]);
  } finally { clearTimeout(timer); }
}

export function createPreauthenticationNonfatalPolicy({ pin, phase, requestPhase, verifyTargetAndOidc,
  hasFatal, inspect, publish = () => {}, now = Date.now }) {
  let used = false; let frozen = false; let pending = null; let first = null;
  const live = () => !frozen && phase() === PRE && hasFatal() === false && verifyTargetAndOidc() === true;
  const structure = (request, code, beforeTransmission) => read(() => live() &&
    requestPhase(request) === PRE && code === "OFF_TARGET_REQUEST_BLOCKED" && beforeTransmission === true &&
    request.url() === FEEDBACK_RESOURCE && request.method() === "GET" && request.resourceType() === "script" &&
    request.isNavigationRequest() === false && request.redirectedFrom() === null && request.serviceWorker() === null &&
    request.frame().url() === `${pin.url}/login`) === true;
  return Object.freeze({
    get first() { return first; },
    get pending() { return pending !== null; },
    async settle() { if (pending) await pending; },
    freeze() {
      if (pending) throw Error("PREAUTH_CLASSIFICATION_PENDING");
      frozen = true; // Budget is never reset, including at submit/cleanup.
    },
    tryBlocked(request, code, beforeTransmission, abort) {
      if (used || !structure(request, code, beforeTransmission)) return Promise.resolve(false);
      used = true; // Atomic reservation before the first asynchronous metadata read.
      const work = (async () => {
        try {
          const facts = await bounded(() => inspect(request, {
            BEFORE_TRANSMISSION: true, RSC_QUERY_PRESENT: false,
            GUARD_RULE: "ASSERT_REQUEST_EXACT_TARGET_COMPOUND", FIRST_FAILED_PREDICATE: "ORIGIN_EQUALS_PIN",
          }));
          if (!exactPreauthenticationFacts(facts) || !structure(request, code, beforeTransmission)) return false;
          await bounded(abort); // NEVER continue/fulfill/attach OIDC headers.
          if (!structure(request, code, beforeTransmission)) return false;
          const timestamp = now();
          if (!Number.isSafeInteger(timestamp) || timestamp <= 0) return false;
          const record = Object.freeze({ ...sanitizePreauthenticationMetadata(facts),
            RECORD: "PREAUTH_NONFATAL_IRRELEVANT_BLOCK", RESOURCE: "VERCEL_FEEDBACK_SCRIPT_EXACT",
            INITIATING_PAGE: "PINNED_PREVIEW_LOGIN", UTC_EPOCH_MS: timestamp,
            NETWORK_DECISION: "BLOCKED", CAPTURE_CONTROL: "NONFATAL_IRRELEVANT_BLOCK",
          });
          receipts.set(record, request);
          try { publish(record); } catch { receipts.delete(record); return false; }
          first = record; // Separate immutable record; never touches the fatal journal.
          return true;
        } catch { return false; } // Original guard remains fatal on any uncertainty.
      })();
      pending = work;
      void work.then(() => { pending = null; });
      return work;
    },
  });
}
