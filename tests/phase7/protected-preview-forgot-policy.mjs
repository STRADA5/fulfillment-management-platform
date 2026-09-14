// Exact capture-control exception ONLY. The request must already be aborted.
// No network/authentication grant, generic RSC rule or application policy change.
import { PIN, assertProof, assertOidcClaims } from "../phase6/hosted-auth-smoke.mjs";
import { isExactForgotRequest } from "./protected-preview-forgot-metadata.mjs";

const FRAMEWORK_NAMES = ["next-router-prefetch", "next-router-segment-prefetch", "next-url", "rsc", "x-deployment-id"];
const VERIFIED_TRUE = ["mainFrameRequest", "mainFrameInitiator", "fetchOrXhr", "automaticallyInitiatedDuringHydration", "frameworkPrefetchInitiatorVerified", "prefetchAttributeOrFrameworkHint", "rscMarkerPresent", "nextRouterPrefetchMarkerPresent", "routerSegmentMarkerPresent", "headerMetadataComplete", "queryPresent", "sameApprovedOrigin", "sameApprovedDeployment", "observerComplete", "userInteractionExcluded", "realNavigationExcluded", "credentialPresenceExcluded", "mutationExcluded", "authenticationPurposeExcluded", "passiveTransportComplete", "passiveRequestCorrelationVerified", "approvedScriptInInitiator", "runnerSyntheticActivationExcluded"];
const VERIFIED_FALSE = ["navigationRequest", "documentRequest", "formSubmission", "userGestureAssociated", "linkClickAssociated", "programmaticNavigation", "routerStateMarkerPresent", "serverActionMarkerPresent", "nextActionHeaderPresent", "requestBodyPresent", "contentLengthPresent", "authorizationHeaderPresent", "cookieHeaderPresent", "otherCredentialHeaderPresent", "unclassifiedHeaderPresent", "redirectAssociated", "crossOriginRedirect", "mutationCapable", "authenticationApi", "supabaseAuth", "fragmentPresent", "userinfoPresent", "nondefaultPortPresent", "serviceWorker", "focusAssociated", "keyboardAssociated", "pointerAssociated", "browserHasUserGesture"];
const OBSERVED_TRUE = ["observerReady", "mainFrame", "pageStillLogin", "navigationObserverAvailable", "forgotLinkPresent", "forgotLinkVisible", "forgotLinkReactBound", "forgotLinkPrefetchNotDisabled", "loginHydrated"];
const OBSERVED_FALSE = ["userGestureSeen", "userActivationSeen", "anyClickSeen", "forgotLinkClickSeen", "formSubmitSeen", "routeNavigationSeen", "programmaticNavigationSeen", "observationError", "documentLoading"];

export function forgotCaptureEligibility(proof, claims, facts) {
  let proofValid = false; let oidcValid = false;
  try { assertProof(proof); proofValid = true; } catch { /* fatal */ }
  try { assertOidcClaims(claims); oidcValid = true; } catch { /* fatal */ }
  const metadata = facts.metadata;
  const names = Array.isArray(metadata?.frameworkHeaderNames) ? [...metadata.frameworkHeaderNames].sort() : [];
  const predicates = {
    IMMUTABLE_PROOF_VALID: proofValid,
    DEVELOPMENT_OIDC_VALID: oidcValid,
    CAPTURE_MODE_ONLY: facts.mode === "CAPTURE_ONLY",
    EXPLICIT_EXCEPTION_ENABLED: facts.enabled === true,
    NOT_METADATA_ONLY: facts.metadataOnly === false,
    NOT_ALREADY_STOPPED: facts.stopped === false,
    NO_PRIOR_FATAL: facts.firstRefusal === null,
    FIRST_FORGOT_ONLY: facts.occurrenceCount === 0,
    ABORT_CONFIRMED: facts.abortConfirmed === true,
    ORIGINAL_NETWORK_DECISION_UNCHANGED: facts.originalDecision === "OUT_OF_SCOPE_PATH_BLOCKED",
    // Only GET/fetch + one _rsc parameter was verified, not HEAD or generic XHR.
    EXACT_REQUEST_IDENTITY: isExactForgotRequest(proof, facts.url, facts.method, facts.resourceType),
    APPROVED_INITIATING_PAGE: facts.initiatingPage === `${PIN.url}/login`,
    APPROVED_PAGE_STILL_LOGIN: facts.applicationPage === `${PIN.url}/login`,
    FRESH_ISOLATED_CONTEXT: facts.freshIsolatedContext === true,
    PRODUCTION_EXCLUDED: facts.productionExcluded === true && proofValid && proof.environment === "Preview",
    EXACT_METADATA_IDENTITY: metadata?.resolvedOrigin === PIN.url && metadata?.resolvedPathname === "/forgot-password" && metadata?.requestMethod === "GET" && metadata?.resourceType === "fetch" && metadata?.initiatorType === "FETCH_API",
    AUTOMATIC_PREFETCH_PROVEN: metadata?.purposeClassification === "AUTOMATIC_FRAMEWORK_PREFETCH",
    EXACT_FRAMEWORK_NAMES: names.length === FRAMEWORK_NAMES.length && names.every((name, index) => name === FRAMEWORK_NAMES[index]),
  };
  for (const key of VERIFIED_TRUE) predicates[`VERIFIED_${key}`] = metadata?.[key] === true;
  for (const key of VERIFIED_FALSE) predicates[`VERIFIED_${key}`] = metadata?.[key] === false;
  for (const key of OBSERVED_TRUE) predicates[`OBSERVED_${key}`] = metadata?.observation?.[key] === true;
  for (const key of OBSERVED_FALSE) predicates[`OBSERVED_${key}`] = metadata?.observation?.[key] === false;
  for (const phase of ["activationBaseline", "activationBeforeRequest"]) for (const key of ["isActive", "hasBeenActive"]) predicates[`${phase}_${key}_FALSE`] = metadata?.[phase]?.[key] === false;
  return { eligible: Object.values(predicates).every(Boolean), predicates };
}

// No synthetic submission to manufacture an auth request. An idle capture stops
// after a fixed interval and reports NOT_OBSERVED, never an authentication PASS.
export async function waitForBoundedPassiveCapture(state, stopped, timeoutMs = 30000) {
  if (state.stopped) return "FATAL_REQUEST_CAPTURED";
  let timer;
  try { return await Promise.race([stopped.then(() => "CAPTURE_STOPPED"), new Promise((accept) => { timer = setTimeout(() => accept("NO_FURTHER_REQUEST_OBSERVED"), timeoutMs); })]); }
  finally { clearTimeout(timer); }
}
