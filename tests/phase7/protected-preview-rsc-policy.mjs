// Capture-control classification only. Never an application/network access grant.
import { PIN, assertProof, assertOidcClaims } from "../phase6/hosted-auth-smoke.mjs";
import { isExactRootRscRequest } from "./protected-preview-rsc-metadata.mjs";

const VERIFIED_FRAMEWORK_NAMES = ["next-router-prefetch", "next-router-segment-prefetch", "next-url", "rsc", "x-deployment-id"];
const VERIFIED_TRUE = ["mainFrameInitiator", "initiatingPathIsLogin", "sameApprovedOrigin", "sameApprovedDeployment", "methodGetOrHead", "headerMetadataComplete", "frameworkDeploymentHeaderPresent", "rscMarkerPresent", "prefetchMarkerPresent", "routerFrameworkMarkerPresent", "fetchOrXhr", "queryPresent", "freshIsolatedContext", "anonymousVerified", "frameworkPrefetchVerified", "bodyAbsenceVerified", "credentialAbsenceVerified", "nonNavigationVerified", "nonRedirectVerified", "nonMutationVerified", "nonServerActionVerified", "nonAuthenticationVerified", "allReviewedConditionsProven"];
const VERIFIED_FALSE = ["requestBodyPresent", "contentLengthHeaderPresent", "authorizationHeaderPresent", "cookieHeaderPresent", "otherCredentialHeaderPresent", "unclassifiedHeaderPresent", "serverActionMarkerPresent", "navigationRequest", "documentRequest", "formSubmission", "serverAction", "redirectAssociated", "crossOriginRedirect", "mutationCapableMethod", "authenticationApi", "supabaseAuth", "fragmentPresent", "userinfoPresent", "nondefaultPortPresent"];

export function rootRscCaptureEligibility(proof, claims, facts) {
  let proofValid = false; let oidcValid = false;
  try { assertProof(proof); proofValid = true; } catch { /* unknown or changed => fatal */ }
  try { assertOidcClaims(claims); oidcValid = true; } catch { /* no tolerance change */ }
  const metadata = facts.metadata;
  const frameworkNames = Array.isArray(metadata?.frameworkHeaderNames) ? [...metadata.frameworkHeaderNames].sort() : [];
  const predicates = {
    IMMUTABLE_PROOF_VALID: proofValid,
    DEVELOPMENT_OIDC_VALID: oidcValid,
    CAPTURE_MODE_ONLY: facts.mode === "CAPTURE_ONLY",
    EXPLICIT_EXCEPTION_ENABLED: facts.enabled === true,
    NOT_METADATA_ONLY: facts.metadataOnly === false,
    NOT_ALREADY_STOPPED: facts.stopped === false,
    NO_PRIOR_FATAL: facts.firstRefusal === null,
    FIRST_ROOT_RSC_ONLY: facts.occurrenceCount === 0,
    ORIGINAL_NETWORK_DECISION_UNCHANGED: facts.originalDecision === "OUT_OF_SCOPE_PATH_BLOCKED",
    EXACT_REQUEST_IDENTITY: isExactRootRscRequest(proof, facts.url, facts.method, facts.resourceType),
    APPROVED_PAGE_STILL_LOGIN: facts.applicationPage === `${PIN.url}/login`,
    NO_SERVICE_WORKER: facts.serviceWorker === false,
    PRODUCTION_EXCLUDED: facts.productionExcluded === true && proofValid && proof.environment === "Preview",
    EXACT_METADATA_IDENTITY: metadata?.initiatingOrigin === PIN.url && metadata?.initiatingPath === "/login" && metadata?.resolvedOrigin === PIN.url && metadata?.resolvedPathname === "/" && metadata?.requestMethod === "GET" && metadata?.resourceType === "fetch" && metadata?.initiatorType === "FETCH_API",
    EXACT_FRAMEWORK_HEADER_NAMES: frameworkNames.length === VERIFIED_FRAMEWORK_NAMES.length && frameworkNames.every((name, index) => name === VERIFIED_FRAMEWORK_NAMES[index]),
  };
  for (const key of VERIFIED_TRUE) predicates[`VERIFIED_${key}`] = metadata?.[key] === true;
  for (const key of VERIFIED_FALSE) predicates[`VERIFIED_${key}`] = metadata?.[key] === false;
  return { eligible: Object.values(predicates).every(Boolean), predicates };
}
