// Capture-only diagnostics. No credential pipe, credential retrieval, or login transmission.
// Reuses the unchanged protected-Preview policy; capture restrictions only REMOVE access.
import { chromium } from "@playwright/test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { rootRscMetadata, waitForRscMetadataStop } from "./protected-preview-rsc-metadata.mjs";
import { rootRscCaptureEligibility } from "./protected-preview-rsc-policy.mjs";
import { isExactForgotRequest, forgotRequestMetadata, waitForForgotMetadataStop } from "./protected-preview-forgot-metadata.mjs";
import { attachPassiveForgotObserver, passiveForgotMetadata } from "./protected-preview-passive-observer.mjs";
import { forgotCaptureEligibility, waitForBoundedPassiveCapture } from "./protected-preview-forgot-policy.mjs";
import { runEmptyFieldSubmit, nativeValidationPreventedRequest, emptySubmissionRequestMetadata } from "./protected-preview-empty-submit.mjs";
import { runSyntheticSubmit, syntheticFailureCode } from "./protected-preview-synthetic-submit.mjs";
import { inspectLoginElements } from "./protected-preview-login-elements.mjs";
import {
  PIN, assertProof, assertRequest, assertOidcClaims, childEnvironment, createPinnedProxy,
  localEvidence, makeCli, liveProof, developmentOidc, getOnce, safeCode,
} from "../phase6/hosted-auth-smoke.mjs";

const HOST = new URL(PIN.url).hostname;
export const TOOLBAR_URL = "https://vercel.live/_next-live/feedback/feedback.js";
const emit = (key, value) => console.log(`P7_CAPTURE_${key}=${value}`);
function requireCheck(value, code) { if (!value) throw new Error(code); }

// Read-only, login-form-specific hydration proof. React's submit event plugin reads
// __reactProps$*.action; checking visible SSR markup alone does not prove hydration.
// Inspect only booleans/types, never serialize React props, fibers or field values.
export function loginHydrationReady(documentRoot = document) {
  const email = documentRoot.querySelector("input#email");
  const password = documentRoot.querySelector('input#password[type="password"]');
  const form = email?.form;
  if (!email || !password || !form || password.form !== form || email.value !== "" || password.value !== "") return false;
  const propsKey = Object.keys(form).find((key) => key.startsWith("__reactProps$"));
  const fiberKey = Object.keys(form).find((key) => key.startsWith("__reactFiber$"));
  if (!propsKey || !fiberKey || typeof form[propsKey]?.action !== "function") return false;
  let fiber = form[fiberKey];
  for (let depth = 0; fiber && depth < 200; depth++) {
    if (fiber.tag === 3) return fiber.stateNode?.current?.memoizedState?.isDehydrated === false;
    fiber = fiber.return;
  }
  return false;
}

// Never serialize URL userinfo, queries, fragments, field values, headers, bodies or errors.
// Only short ordinary route segments are preserved; encoded/private/opaque segments redact.
export function redactUrl(raw) {
  let url;
  try { url = new URL(raw); } catch { return { url: "UNKNOWN", origin: "UNKNOWN", hostname: "UNKNOWN", pathname: "UNKNOWN", protocol: "UNKNOWN", port: "UNKNOWN", queryNames: [] }; }
  const http = ["https:", "http:"].includes(url.protocol);
  const hostname = http && /^[a-z0-9.-]{1,253}$/.test(url.hostname) ? url.hostname : "REDACTED";
  const pathname = http ? url.pathname.split("/").map((part) => {
    if (!part) return "";
    return /^[a-z_.-][a-z0-9_.-]{0,47}$/i.test(part) && !/^(?:eyJ|sk_|sb_secret_|sb_publishable_|ghp_|gho_|github_pat_)/.test(part) ? part : "[REDACTED]";
  }).join("/") : "[REDACTED_NON_HTTP_PATH]";
  const origin = http && hostname !== "REDACTED" ? `${url.protocol}//${hostname}${url.port ? `:${url.port}` : ""}` : "UNKNOWN";
  const queryNames = [...new Set(url.searchParams.keys())].slice(0, 20).map((key) => /^[a-z_][a-z0-9_-]{0,39}$/i.test(key) ? key : "[REDACTED_NAME]");
  return { url: `${origin}${pathname}`, origin, hostname, pathname, protocol: /^[a-z-]{1,20}:$/.test(url.protocol) ? url.protocol : "REDACTED", port: url.port || (url.protocol === "https:" ? "443 (default)" : url.protocol === "http:" ? "80 (default)" : "NONE"), queryNames };
}

export function requestDiagnostic(proof, raw, method, details = {}) {
  let url;
  try { url = new URL(raw); } catch { /* Guard below supplies the actual refusal code. */ }
  // Same individual predicates and order as assertRequest's unchanged compound guard.
  const predicates = {
    ORIGIN_EQUALS_PIN: !!url && url.origin === PIN.url,
    PROTOCOL_HTTPS: !!url && url.protocol === "https:",
    HOSTNAME_EQUALS_PIN: !!url && url.hostname === HOST,
    USERNAME_ABSENT: !!url && !url.username,
    PASSWORD_ABSENT: !!url && !url.password,
    NONDEFAULT_PORT_ABSENT: !!url && !url.port,
    FRAGMENT_ABSENT: !!url && !url.hash,
  };
  let guardResult = "PASS";
  try { assertRequest(proof, raw, method); } catch (error) { guardResult = safeCode(error); }
  const first = Object.entries(predicates).find(([, passed]) => !passed)?.[0] ?? "NONE";
  const destination = redactUrl(raw);
  const initiating = redactUrl(details.initiatingPage ?? "");
  return {
    initiatingPageUrl: initiating.url, initiatingPageOrigin: initiating.origin,
    method: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"].includes(method) ? method : "OTHER",
    originalUrlForm: ["RELATIVE", "ABSOLUTE"].includes(details.originalUrlForm) ? details.originalUrlForm : "UNKNOWN",
    baseUrl: details.baseUrl ? redactUrl(details.baseUrl).url : "UNKNOWN",
    resolvedUrl: destination.url, resolvedOrigin: destination.origin, resolvedHostname: destination.hostname,
    resolvedPathname: destination.pathname, resolvedProtocol: destination.protocol, resolvedPort: destination.port,
    queryParameterNames: destination.queryNames,
    resourceType: ["document", "stylesheet", "image", "media", "font", "script", "texttrack", "xhr", "fetch", "eventsource", "websocket", "manifest", "other"].includes(details.resourceType) ? details.resourceType : "UNKNOWN",
    initiatorCategory: ["NEXTJS_SERVER_ACTION_FETCH", "FETCH_API", "NATIVE_FORM_NAVIGATION"].includes(details.mechanism) ? details.mechanism : "UNKNOWN",
    originalUrlObservation: ["RELATIVE", "ABSOLUTE"].includes(details.originalUrlForm) ? "PRE_RESOLUTION_FETCH_INPUT" : "PLAYWRIGHT_EXPOSES_RESOLVED_URL_ONLY",
    redirectDestination: details.redirected ? destination.url : "NONE_OBSERVED",
    sameApprovedOrigin: !!url && url.origin === PIN.url,
    sameApprovedDeployment: !!url && url.origin === PIN.url ? "YES" : "UNKNOWN",
    supabaseStagingHostnameMatches: !!url && url.hostname === "nftufhffzlokryafcbku.supabase.co",
    destinationFromApplicationRuntimeConfig: "UNKNOWN",
    normalizedOrigin: destination.origin, normalizedHostname: destination.hostname,
    guardRule: "assertRequest: exact origin AND HTTPS AND exact hostname AND no userinfo AND no nondefault port AND no fragment",
    guardResult, guardPredicates: predicates,
    firstFailedPredicate: guardResult === "OFF_TARGET_REQUEST_BLOCKED" ? first : guardResult === "PASS" ? "NONE" : "OTHER_GUARD_STAGE",
  };
}

export function captureDecision(proof, raw, method, alreadyStopped = false) {
  if (alreadyStopped) return "CAPTURE_ALREADY_STOPPED";
  let url;
  try { url = assertRequest(proof, raw, method); } catch (error) { return safeCode(error); }
  if (method !== "GET" && method !== "HEAD") return "CAPTURE_ONLY_MUTATION_ABORT";
  if (url.pathname !== "/login" && url.pathname !== "/favicon.ico" && !url.pathname.startsWith("/_next/static/")) return "CAPTURE_ONLY_NAVIGATION_ABORT";
  return "ALLOW_LOGIN_GET_OR_ASSET";
}

// Diagnostic classification, NOT a network allow rule. Unknown facts are false.
export function toolbarEligibility(proof, facts) {
  let proofValid = false;
  try { assertProof(proof); proofValid = true; } catch { /* fail closed */ }
  const predicates = {
    IMMUTABLE_PROOF_VALID: proofValid,
    CAPTURE_MODE_ONLY: facts.mode === "CAPTURE_ONLY",
    NOT_ALREADY_STOPPED: facts.stopped === false,
    EXACT_TOOLBAR_URL: facts.url === TOOLBAR_URL,
    GET_SCRIPT_ONLY: facts.method === "GET" && facts.resourceType === "script",
    APPROVED_MAIN_FRAME: facts.applicationPage === `${PIN.url}/login` && facts.frameUrl === `${PIN.url}/login` && facts.mainFrame === true,
    NOT_NAVIGATION: facts.navigation === false,
    NOT_REDIRECT: facts.redirected === false,
    NO_SERVICE_WORKER: facts.serviceWorker === false,
    NO_FORM_OR_SERVER_ACTION: facts.formSubmission === false && facts.serverAction === false,
    BODY_ABSENT: facts.bodyAbsent === true,
    CREDENTIALS_ABSENT: facts.credentialsAbsent === true,
    PRODUCTION_EXCLUDED: facts.productionExcluded === true,
    FIRST_TOOLBAR_ONLY: facts.irrelevantBlockCount === 0,
  };
  return { eligible: Object.values(predicates).every(Boolean), predicates };
}

export function productionExcludesToolbar(project) {
  if (project?.id !== PIN.projectId || project?.name !== PIN.project || project?.accountId !== PIN.teamId || !project.targets || typeof project.targets !== "object") return false;
  // An explicitly returned targets object without production records no Production target.
  if (!Object.hasOwn(project.targets, "production")) return true;
  const production = project.targets.production;
  if (!production || typeof production.url !== "string" || !Array.isArray(production.alias) || !production.alias.every((item) => typeof item === "string")) return false;
  const hosts = [production.url, ...production.alias];
  return hosts.every((host) => /^[a-z0-9.-]+$/i.test(host) && host.toLowerCase() !== "vercel.live");
}

const ORDINARY_SCRIPT_HEADERS = new Set(["accept", "accept-encoding", "accept-language", "cache-control", "connection", "host", "pragma", "priority", "referer", "origin", "user-agent", "dnt", "sec-gpc", "sec-ch-ua", "sec-ch-ua-mobile", "sec-ch-ua-platform", "sec-fetch-dest", "sec-fetch-mode", "sec-fetch-site", "sec-fetch-user", "upgrade-insecure-requests"]);
export function scriptCredentialsAbsent(privateHeaders) {
  return Array.isArray(privateHeaders) && privateHeaders.every((item) => {
    if (typeof item?.name !== "string" || typeof item.value !== "string") return false;
    const name = item.name.toLowerCase();
    if (!ORDINARY_SCRIPT_HEADERS.has(name)) return false;
    if (name === "referer") return item.value === `${PIN.url}/login` || item.value === `${PIN.url}/`;
    if (name === "origin") return item.value === PIN.url;
    if (name === "host") return item.value === "vercel.live";
    return true;
  });
}

// All access decisions precede header attachment / route.continue. First refusal wins.
export function createCaptureHandler(proof, oidc, state, capture, urlForms = new Map(), policy = {}) {
  const handle = async (route) => {
    const request = route.request();
    if (state.stopped) { await route.abort().catch(() => {}); return; }
    let decision = captureDecision(proof, request.url(), request.method());
    try { assertOidcClaims(oidc.claims); } catch (error) { decision = safeCode(error); }
    let privateHeaders;
    try { privateHeaders = await request.headersArray(); } catch { decision = "REQUEST_HEADER_METADATA_UNAVAILABLE"; }
    const headerMetadataKnown = Array.isArray(privateHeaders) && privateHeaders.every((item) => typeof item?.name === "string" && typeof item.value === "string");
    if (!headerMetadataKnown) decision = "REQUEST_HEADER_METADATA_UNAVAILABLE";
    const headerNames = headerMetadataKnown ? privateHeaders.map((item) => item.name.toLowerCase()) : [];
    const credentialBearing = headerNames.some((name) => /authorization|cookie|token|api[-_]?key|secret|credential|password/i.test(name));
    const serverAction = headerNames.includes("next-action");
    let navigation; let redirected; let initiatingPage = ""; let frame; let framePage;
    try { navigation = request.isNavigationRequest(); redirected = request.redirectedFrom() !== null; frame = request.frame(); framePage = frame.page(); initiatingPage = frame.url(); } catch { /* eligibility remains false */ }
    if (typeof navigation !== "boolean" || typeof redirected !== "boolean") decision = "REQUEST_NAVIGATION_METADATA_UNAVAILABLE";
    const authRelevant = !["GET", "HEAD"].includes(request.method()) || ["fetch", "xhr"].includes(request.resourceType()) || serverAction || credentialBearing || /\/(?:auth|api)(?:\/|$)/i.test(redactUrl(request.url()).pathname);
    // Before any prefetch shortcut: fetch/XHR and every auth-related request stop.
    if (decision === "ALLOW_LOGIN_GET_OR_ASSET" && (authRelevant || redirected === true || (navigation === true && (request.url() !== `${PIN.url}/login` || state.loginNavigationSeen === true)))) decision = "CAPTURE_ONLY_AUTH_REVIEW_ABORT";
    let toolbarSafety;
    if (decision === "OFF_TARGET_REQUEST_BLOCKED" && request.url() === TOOLBAR_URL && request.method() === "GET" && request.resourceType() === "script") {
      let bodyAbsent = false;
      // Null-presence check ONLY for this GET script. Never inspect/decode/copy body bytes.
      try { bodyAbsent = request.postDataBuffer() === null; } catch { /* unknown remains fatal */ }
      let serviceWorker;
      try { serviceWorker = request.serviceWorker() !== null; } catch { /* unknown remains fatal */ }
      toolbarSafety = toolbarEligibility(proof, {
        mode: policy.mode, stopped: state.stopped, url: request.url(), method: request.method(), resourceType: request.resourceType(),
        applicationPage: policy.page?.url(), frameUrl: initiatingPage,
        mainFrame: !!frame && framePage === policy.page && frame === policy.page?.mainFrame(), navigation, redirected, serviceWorker,
        formSubmission: navigation === true && request.method() === "POST", serverAction,
        bodyAbsent, credentialsAbsent: headerMetadataKnown && scriptCredentialsAbsent(privateHeaders),
        productionExcluded: policy.productionExcluded, irrelevantBlockCount: state.irrelevantBlockCount,
      });
      if (toolbarSafety.eligible && !authRelevant) {
        state.irrelevantBlockCount += 1; // Reserve before await; no repeated exception.
        try { await route.abort(); }
        catch { state.stopped = true; capture({ captureControl: "FATAL", captureAbortReason: "TOOLBAR_ABORT_NOT_CONFIRMED" }); return; }
        const record = requestDiagnostic(proof, request.url(), request.method(), { initiatingPage, resourceType: "script" });
        record.networkDecision = "BLOCKED";
        record.captureControl = "NONFATAL_IRRELEVANT_BLOCK";
        record.toolbarPredicates = toolbarSafety.predicates;
        state.irrelevantRefusal = record;
        policy.onIrrelevant?.(record);
        return; // Never attach an OIDC/protection header and never continue this request.
      }
    }
    let rscDetails; let rscSafety;
    if (policy.rscCaptureOnce === true && decision === "OUT_OF_SCOPE_PATH_BLOCKED") {
      rscDetails = rootRscMetadata(proof, request, {
        headerNames, headersKnown: headerMetadataKnown, navigation, redirected, initiatingPage, frame, framePage,
        page: policy.page, freshIsolatedContext: policy.freshIsolatedContext,
      });
      if (rscDetails) {
        let serviceWorker;
        try { serviceWorker = request.serviceWorker() !== null; } catch { /* unknown remains fatal */ }
        rscSafety = rootRscCaptureEligibility(proof, oidc.claims, {
          metadata: rscDetails, mode: policy.mode, enabled: policy.rscCaptureOnce, metadataOnly: policy.rscMetadataOnly,
          stopped: state.stopped, firstRefusal: state.firstRefusal, occurrenceCount: state.rscNonfatalBlockCount,
          originalDecision: decision, url: request.url(), method: request.method(), resourceType: request.resourceType(),
          applicationPage: policy.page?.url(), serviceWorker, productionExcluded: policy.productionExcluded,
        });
        if (rscSafety.eligible) {
          // The serialized handler prevents another request from consuming this
          // budget while abort is pending. No exception unless abort succeeds.
          try { await route.abort(); }
          catch { state.stopped = true; capture({ captureControl: "FATAL", captureAbortReason: "RSC_ABORT_NOT_CONFIRMED" }); return; }
          state.rscNonfatalBlockCount += 1;
          const observed = urlForms.get(redactUrl(request.url()).url);
          const record = requestDiagnostic(proof, request.url(), request.method(), { initiatingPage, resourceType: "fetch", originalUrlForm: observed?.form, baseUrl: observed?.base, mechanism: "FETCH_API", redirected });
          record.networkDecision = "BLOCKED";
          record.captureControl = "NONFATAL_IRRELEVANT_BLOCK";
          record.rscMetadata = rscDetails;
          record.rscPredicates = rscSafety.predicates;
          record.rscAbortConfirmed = true;
          state.rscIrrelevantRefusal = record;
          policy.onRscIrrelevant?.(record);
          return; // No protection header attachment; no route.continue.
        }
      }
    }
    if (policy.forgotCaptureOnce === true && policy.passiveForgotObserver && isExactForgotRequest(proof, request.url(), request.method(), request.resourceType())) {
      // Abort first; only capture control may become nonfatal. The serialized
      // handler prevents a concurrent request from consuming this budget twice.
      const record = requestDiagnostic(proof, request.url(), request.method(), { initiatingPage, resourceType: request.resourceType(), redirected, mechanism: "FETCH_API" });
      record.networkDecision = "BLOCKED";
      record.captureControl = "FATAL";
      record.captureAbortReason = decision;
      try { await route.abort(); record.forgotPasswordAbortConfirmed = true; }
      catch { state.stopped = true; record.forgotPasswordAbortConfirmed = false; record.captureAbortReason = "FORGOT_ABORT_NOT_CONFIRMED"; state.firstRefusal = record; capture(record); return; }
      const evidence = await policy.passiveForgotObserver.forRequest(request);
      const details = passiveForgotMetadata(proof, request, {
        headerNames, headersKnown: headerMetadataKnown, navigation, redirected, initiatingPage, frame, framePage,
        page: policy.page, freshIsolatedContext: policy.freshIsolatedContext, passiveOnly: true,
        loginResponseObserved: state.loginResponseObserved === true,
      }, evidence);
      const safety = forgotCaptureEligibility(proof, oidc.claims, {
        metadata: details, mode: policy.mode, enabled: policy.forgotCaptureOnce, metadataOnly: policy.forgotMetadataOnly,
        stopped: state.stopped, firstRefusal: state.firstRefusal, occurrenceCount: state.forgotNonfatalBlockCount,
        abortConfirmed: record.forgotPasswordAbortConfirmed, originalDecision: decision,
        url: request.url(), method: request.method(), resourceType: request.resourceType(), initiatingPage,
        applicationPage: policy.page?.url(), freshIsolatedContext: policy.freshIsolatedContext, productionExcluded: policy.productionExcluded,
      });
      record.forgotPasswordMetadata = details;
      record.forgotPredicates = safety.predicates;
      if (safety.eligible) {
        state.forgotNonfatalBlockCount += 1;
        record.captureControl = "NONFATAL_IRRELEVANT_BLOCK";
        record.singleOccurrenceOnly = true;
        record.authenticationRelevant = false; // Positively classified prefetch only.
        state.forgotIrrelevantRefusal = record;
        policy.onForgotIrrelevant?.(record);
      } else {
        state.stopped = true;
        record.authenticationRelevant = authRelevant;
        state.firstRefusal = record;
        capture(record);
      }
      return; // No headers attached, route.continue or authentication allowed.
    }
    if (decision !== "ALLOW_LOGIN_GET_OR_ASSET") {
      state.stopped = true;
      const safe = redactUrl(request.url());
      const observed = request.resourceType() === "fetch" ? urlForms.get(safe.url) : undefined;
      const metadata = requestDiagnostic(proof, request.url(), request.method(), {
        initiatingPage, resourceType: request.resourceType(),
        originalUrlForm: observed?.form, baseUrl: observed?.base,
        redirected,
        mechanism: serverAction && request.resourceType() === "fetch" ? "NEXTJS_SERVER_ACTION_FETCH" : request.resourceType() === "fetch" ? "FETCH_API" : request.resourceType() === "document" && request.method() === "POST" ? "NATIVE_FORM_NAVIGATION" : "UNKNOWN",
      });
      metadata.loginFormHydrationVerified = state.hydrationCompleted === true;
      metadata.emptyFieldRequestConstructionEntered = state.emptyFormConstruction === true;
      metadata.serverActionHeaderPresent = serverAction;
      metadata.hydratedAuthRequestCaptured = serverAction && state.hydrationCompleted === true && state.emptyFormConstruction === true;
      metadata.authenticationRelevant = authRelevant;
      if (policy.emptyFieldSubmitOnce === true) metadata.emptySubmissionMetadata = emptySubmissionRequestMetadata(request, {
        headersKnown: headerMetadataKnown, credentialBearing, serverAction, navigation, redirected, submitInvoked: state.emptyFieldSubmitCount === 1,
      });
      if (policy.syntheticSubmitOnce === true) {
        metadata.syntheticSubmissionMetadata = emptySubmissionRequestMetadata(request, {
          headersKnown: headerMetadataKnown, credentialBearing, serverAction, navigation, redirected, submitInvoked: state.syntheticSubmitCount === 1,
        });
        metadata.syntheticRequestConstructionEntered = state.syntheticSubmitCount === 1;
      }
      metadata.captureAbortReason = decision;
      metadata.networkDecision = "BLOCKED";
      metadata.captureControl = "FATAL_OR_AUTH_CAPTURE_STOP";
      if (toolbarSafety) metadata.toolbarPredicates = toolbarSafety.predicates;
      if (rscDetails) metadata.rscMetadata = rscDetails;
      if (rscSafety) metadata.rscPredicates = rscSafety.predicates;
      if (policy.rscMetadataOnly === true) {
        const details = rscDetails ?? rootRscMetadata(proof, request, {
          headerNames, headersKnown: headerMetadataKnown, navigation, redirected, initiatingPage, frame, framePage,
          page: policy.page, freshIsolatedContext: policy.freshIsolatedContext,
        });
        if (details) metadata.rscMetadata = details;
      }
      let forgotAborted = false;
      if (policy.forgotMetadataOnly === true && policy.passiveForgotObserver && isExactForgotRequest(proof, request.url(), request.method(), request.resourceType())) {
        // Stop/abort FIRST. Wait only for already-emitted passive metadata, never
        // for another request or an evaluation reply. Classification grants no access.
        metadata.captureControl = "FATAL";
        try { await route.abort(); metadata.forgotPasswordAbortConfirmed = true; }
        catch { metadata.forgotPasswordAbortConfirmed = false; metadata.captureAbortReason = "FORGOT_ABORT_NOT_CONFIRMED"; }
        forgotAborted = true;
        const evidence = await policy.passiveForgotObserver.forRequest(request);
        metadata.forgotPasswordMetadata = passiveForgotMetadata(proof, request, {
          headerNames, headersKnown: headerMetadataKnown, navigation, redirected, initiatingPage, frame, framePage,
          page: policy.page, freshIsolatedContext: policy.freshIsolatedContext, passiveOnly: true,
          loginResponseObserved: state.loginResponseObserved === true,
        }, evidence);
      } else if (policy.forgotMetadataOnly === true) {
        const observation = policy.forgotObservation?.();
        const details = forgotRequestMetadata(proof, request, {
          headerNames, headersKnown: headerMetadataKnown, navigation, redirected, initiatingPage, frame, framePage,
          page: policy.page, freshIsolatedContext: policy.freshIsolatedContext, passiveOnly: true,
          observation: observation?.metadata, observationFrameMatches: observation?.frame === frame,
        });
        if (details) metadata.forgotPasswordMetadata = details;
      }
      state.firstRefusal = metadata;
      if (forgotAborted) {
        // Already aborted above; even positive prefetch proof remains fatal.
      } else if (metadata.forgotPasswordMetadata) {
        try { await route.abort(); metadata.forgotPasswordAbortConfirmed = true; }
        catch { metadata.forgotPasswordAbortConfirmed = false; metadata.captureAbortReason = "FORGOT_ABORT_NOT_CONFIRMED"; }
      } else if (metadata.rscMetadata) {
        try { await route.abort(); metadata.rscAbortConfirmed = true; }
        catch { metadata.rscAbortConfirmed = false; metadata.captureAbortReason = "RSC_ABORT_NOT_CONFIRMED"; }
      } else if (policy.emptyFieldSubmitOnce === true || policy.syntheticSubmitOnce === true) {
        try { await route.abort(); metadata.authRequestAbortConfirmed = true; }
        catch { metadata.authRequestAbortConfirmed = false; metadata.captureAbortReason = "AUTH_ABORT_NOT_CONFIRMED"; }
      } else { await route.abort().catch(() => {}); }
      capture(metadata);
      return;
    }
    if (navigation === true) state.loginNavigationSeen = true;
    const headers = { ...request.headers(), "x-vercel-trusted-oidc-idp-token": oidc.token };
    if (headers["x-vercel-protection-bypass"] || headers.authorization) {
      state.stopped = true; await route.abort(); throw new Error("BROAD_AUTH_HEADER_BLOCKED");
    }
    // Non-GET/HEAD requests can never reach here, regardless of login form state.
    await route.continue({ headers });
    state.forwardedReadOnlyRequests += 1;
  };
  // Preserve arrival order across asynchronous metadata/abort operations.
  let queue = Promise.resolve();
  return (route) => {
    const current = queue.then(() => handle(route)).catch(async () => {
      state.stopped = true;
      await route.abort().catch(() => {});
      capture({ captureControl: "FATAL", captureAbortReason: "CAPTURE_METADATA_OR_ABORT_FAILURE" });
    });
    queue = current;
    return current;
  };
}

export async function main(args = process.argv.slice(2)) {
  const rscMetadataOnly = args.length === 3 && args[2] === "--rsc-metadata-only";
  const forgotMetadataOnly = args.length === 3 && args[2] === "--forgot-metadata-only";
  const emptyFieldSubmitOnce = args.length === 3 && args[2] === "--empty-field-submit-once";
  const syntheticSubmitOnce = args.length === 3 && args[2] === "--synthetic-submit-once";
  const loginElementsOnly = args.length === 3 && args[2] === "--login-elements-only";
  const forgotCaptureOnce = (args.length === 3 && args[2] === "--forgot-capture-once") || emptyFieldSubmitOnce || syntheticSubmitOnce || loginElementsOnly;
  const passiveForgotMode = forgotMetadataOnly || forgotCaptureOnce;
  const rscCaptureOnce = (args.length === 3 && args[2] === "--rsc-capture-once") || passiveForgotMode;
  requireCheck((args.length === 2 || rscMetadataOnly || rscCaptureOnce) && args[0] === "--vercel-cli", "CAPTURE_ARGUMENTS_INVALID");
  requireCheck(!process.env.PHASE6_PREVIEW_URL && !process.env.PHASE7_PREVIEW_URL && !process.env.VERCEL_AUTOMATION_BYPASS_SECRET && !process.env.DEBUG && !process.env.PWDEBUG && !process.env.NODE_OPTIONS, "UNAPPROVED_PROCESS_OVERRIDE");
  localEvidence(); emit("LOCAL_IDENTITY", "PASS");
  if (rscMetadataOnly) emit("RSC_METADATA_ONLY", "YES");
  if (rscCaptureOnce) emit("RSC_CAPTURE_ONCE", "YES");
  if (forgotMetadataOnly) emit("FORGOT_METADATA_ONLY", "YES");
  if (forgotCaptureOnce) emit("FORGOT_CAPTURE_ONCE", "YES");
  if (emptyFieldSubmitOnce) emit("EMPTY_FIELD_SUBMIT_ONCE", "YES");
  if (syntheticSubmitOnce) emit("SYNTHETIC_SUBMIT_ONCE", "YES");
  if (loginElementsOnly) emit("LOGIN_ELEMENTS_ONLY", "YES");
  const cli = makeCli(args[1]);
  const { proof } = await liveProof(cli);
  emit("TARGET_SAFETY", "PASS");
  // Fixed project control-plane GET only; never visit a Production URL or serialize settings.
  const projectForExclusion = JSON.parse(await cli("api", `/v9/projects/${PIN.projectId}`, "--method", "GET", "--raw"));
  const toolbarProductionExcluded = productionExcludesToolbar(projectForExclusion);
  requireCheck(toolbarProductionExcluded, "TOOLBAR_PRODUCTION_EXCLUSION_UNVERIFIED");
  emit("TOOLBAR_PRODUCTION_EXCLUDED", "YES");
  const oidc = await developmentOidc(cli, proof);
  emit("DEVELOPMENT_OIDC", "PASS");
  const state = { stopped: false, firstRefusal: null, forwardedReadOnlyRequests: 0, hydrationCompleted: false, emptyFormConstruction: false, irrelevantBlockCount: 0, rscNonfatalBlockCount: 0, forgotNonfatalBlockCount: 0, loginNavigationSeen: false, interceptionArmed: false, emptyFieldSubmitCount: 0, syntheticSubmitCount: 0, elementInventoryCount: 0 };
  let proxy; let browser; let context;
  try {
    const loginUrl = `${PIN.url}/login`;
    assertRequest(proof, loginUrl, "GET");
    const response = await getOnce(loginUrl); // no redirects followed; no application credentials
    let ssoRedirect = false;
    if (response.headers.location) { const destination = new URL(response.headers.location, loginUrl); ssoRedirect = destination.origin === "https://vercel.com" && destination.pathname === "/sso-api"; }
    requireCheck(([301, 302, 303, 307, 308].includes(response.status) && ssoRedirect) || ([401, 403].includes(response.status) && /Vercel Authentication|Authentication Required|Deployment Protection/i.test(response.body.toString())), "UNAUTHENTICATED_PROTECTION_NOT_PROVEN");
    emit("UNAUTHENTICATED_PROTECTION", "PASS");
    proxy = await createPinnedProxy(proof);
    browser = await chromium.launch({ headless: true, channel: "msedge", env: childEnvironment(), proxy: { server: proxy.url, bypass: "<-loopback>" }, args: ["--disable-http2", "--disable-quic", "--force-webrtc-ip-handling-policy=disable_non_proxied_udp"] });
    context = await browser.newContext({ baseURL: PIN.url, serviceWorkers: "block", acceptDownloads: false });
    context.setDefaultTimeout(10000);
    const urlForms = new Map();
    // Playwright binding replies evaluate with userGesture:true. Neither binding
    // nor its awaiting fetch wrapper may run in the passive metadata-only mode.
    if (!passiveForgotMode) {
    await context.exposeBinding("__p7CaptureUrlForm", (_source, metadata) => {
      // Preserve only sanitized URL structure and URL form; never inspect fetch init/body.
      if (state.stopped || !metadata || typeof metadata.url !== "string" || typeof metadata.base !== "string") return;
      let absolute;
      try { absolute = new URL(metadata.url, metadata.base).href; } catch { return; }
      if (urlForms.size >= 32) return;
      urlForms.set(redactUrl(absolute).url, { form: ["RELATIVE", "ABSOLUTE"].includes(metadata.form) ? metadata.form : "UNKNOWN", base: redactUrl(metadata.base).url });
    });
    await context.addInitScript(() => {
      const originalFetch = window.fetch;
      window.fetch = async function(input, ...rest) {
        const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input instanceof Request ? input.url : null;
        // Await diagnostic IPC before invoking native fetch so the route handler
        // cannot race ahead of original URL-form metadata. Never inspect rest/body.
        if (raw !== null) await window.__p7CaptureUrlForm({ url: raw, base: document.baseURI, form: input instanceof Request ? "UNKNOWN" : /^[a-z][a-z0-9+.-]*:/i.test(raw) ? "ABSOLUTE" : "RELATIVE" });
        return originalFetch.call(this, input, ...rest);
      };
    });
    }
    let resolveStopped;
    const stopped = new Promise((accept) => { resolveStopped = accept; });
    let resolveFrameworkReady;
    const frameworkReady = new Promise((accept) => { resolveFrameworkReady = accept; });
    await context.routeWebSocket("**/*", (socket) => { state.stopped = true; socket.close(); emit("WEBSOCKET_ABORT", "YES"); resolveStopped(); });
    const page = await context.newPage();
    const passiveForgotObserver = passiveForgotMode ? await attachPassiveForgotObserver(page, proof, (baseline) => {
      const yesNo = (value) => typeof value === "boolean" ? value ? "YES" : "NO" : "UNKNOWN";
      emit("USER_ACTIVATION_IS_ACTIVE_BASELINE", yesNo(baseline.isActive));
      emit("USER_ACTIVATION_HAS_BEEN_ACTIVE_BASELINE", yesNo(baseline.hasBeenActive));
    }) : null;
    await context.route("**/*", createCaptureHandler(proof, oidc, state, (metadata) => { emit("FIRST_REFUSAL_JSON", JSON.stringify(metadata)); resolveStopped(); }, urlForms, {
      mode: "CAPTURE_ONLY", page, productionExcluded: toolbarProductionExcluded,
      rscMetadataOnly, rscCaptureOnce, freshIsolatedContext: true,
      forgotMetadataOnly, forgotCaptureOnce, passiveForgotObserver, emptyFieldSubmitOnce, syntheticSubmitOnce,
      onIrrelevant: (metadata) => emit("TOOLBAR_REFUSAL_JSON", JSON.stringify(metadata)),
      onRscIrrelevant: (metadata) => emit("RSC_REFUSAL_JSON", JSON.stringify(metadata)),
      onForgotIrrelevant: (metadata) => { emit("FORGOT_REFUSAL_JSON", JSON.stringify(metadata)); resolveFrameworkReady(); },
    }));
    state.interceptionArmed = true;
    page.on("response", (item) => { if (item.url() === loginUrl && item.status() === 200) { state.loginResponseObserved = true; emit("APPROVED_PREVIEW_REACHED", "YES"); } });
    await Promise.race([page.goto("/login", { waitUntil: "domcontentloaded" }).catch(() => { if (!state.stopped) throw new Error("LOGIN_PAGE_LOAD_FAILED"); }), stopped]);
    if (rscMetadataOnly) {
      await waitForRscMetadataStop(state, stopped);
      return; // Always exit before DOM/hydration observation or form submission.
    }
    if (forgotMetadataOnly) {
      // Let normal /login hydration run passively. No clicks, DOM changes,
      // prefetch calls, form construction, field inspection or login attempt.
      await waitForForgotMetadataStop(state, stopped);
      return; // First fatal request ends this mode; never enter requestSubmit().
    }
    if (loginElementsOnly) {
      let inventoryTimer;
      try { await Promise.race([frameworkReady, stopped, new Promise((_, reject) => { inventoryTimer = setTimeout(() => reject(Error("ELEMENT_INVENTORY_PREFLIGHT_TIMEOUT")), 30000); })]); }
      finally { clearTimeout(inventoryTimer); }
      if (state.stopped) return;
      emit("LOGIN_ELEMENTS_JSON", JSON.stringify(await inspectLoginElements(page, state, proof, oidc.claims)));
      return; // Metadata only: no value reads, input, synthetic submit or authentication.
    }
    if (syntheticSubmitOnce) {
      let preflightTimer;
      try { await Promise.race([frameworkReady, stopped, new Promise((_, reject) => { preflightTimer = setTimeout(() => reject(Error("SYNTHETIC_PREFLIGHT_TIMEOUT")), 30000); })]); }
      finally { clearTimeout(preflightTimer); }
      if (state.stopped) return;
      emit("INTERCEPTION_ARMED_BEFORE_INPUT", state.interceptionArmed ? "YES" : "NO");
      const result = await runSyntheticSubmit(page, state, proof, oidc.claims, urlForms, redactUrl);
      requireCheck(Object.values(result).every(value => typeof value === "boolean"), "SYNTHETIC_NONBOOLEAN_METADATA");
      emit("SYNTHETIC_SUBMIT_RESULT_JSON", JSON.stringify(result));
      if (!result.invoked) { emit("SYNTHETIC_OUTCOME", "CLIENT_SIDE_VALIDATION_NO_NETWORK_REQUEST"); return; }
      await waitForBoundedPassiveCapture(state, stopped, 10000);
      emit("SYNTHETIC_OUTCOME", state.firstRefusal?.authenticationRelevant && state.firstRefusal?.authRequestAbortConfirmed === true ? "AUTH_REQUEST_CAPTURED_AND_ABORTED" : state.firstRefusal ? "FATAL_REFUSAL" : "NO_REQUEST_CAUSE_UNPROVEN");
      return; // Never enter any other submit mode, credential path or navigation.
    }
    if (emptyFieldSubmitOnce) {
      let preflightTimer;
      try { await Promise.race([frameworkReady, stopped, new Promise((_, reject) => { preflightTimer = setTimeout(() => reject(Error("EMPTY_SUBMIT_PREFLIGHT_TIMEOUT")), 30000); })]); }
      finally { clearTimeout(preflightTimer); }
      if (state.stopped) return;
      emit("INTERCEPTION_ARMED_BEFORE_SUBMIT", state.interceptionArmed ? "YES" : "NO");
      const result = await runEmptyFieldSubmit(page, state, proof, oidc.claims);
      for (const [key, value] of Object.entries(result)) requireCheck(typeof value === "boolean", "EMPTY_SUBMIT_NONBOOLEAN_METADATA");
      emit("EMPTY_SUBMIT_RESULT_JSON", JSON.stringify(result));
      await waitForBoundedPassiveCapture(state, stopped, 3000);
      emit("NATIVE_VALIDATION_PREVENTED_REQUEST", nativeValidationPreventedRequest(result, state) ? "YES" : "NO");
      emit("EMPTY_SUBMIT_OUTCOME", state.firstRefusal ? "REQUEST_CAPTURED" : nativeValidationPreventedRequest(result, state) ? "CLIENT_SIDE_VALIDATION_NO_NETWORK_REQUEST" : "NO_REQUEST_CAUSE_UNPROVEN");
      return; // Never reach the legacy validation-bypassing diagnostic below.
    }
    if (forgotCaptureOnce) {
      emit("BOUNDED_CAPTURE_OUTCOME", await waitForBoundedPassiveCapture(state, stopped));
      return; // No field population, synthetic submission or real authentication.
    }
    // Read local DOM only. No further navigation/authentication after any refusal.
    if (await page.getByRole("heading", { name: "Sign in", exact: true }).count() === 1 && await page.locator("input#email").count() === 1 && await page.locator('input#password[type="password"]').count() === 1) emit("APPLICATION_LOGIN_PAGE_REACHED", "YES");
    if (state.stopped) return;
    await Promise.race([page.getByRole("heading", { name: "Sign in", exact: true }).waitFor(), stopped]);
    if (state.stopped) return;
    requireCheck(assertRequest(proof, page.url()).pathname === "/login", "LOGIN_PAGE_TARGET_MISMATCH");
    emit("HYDRATION_WAIT", "ENTERED");
    await Promise.race([
      page.waitForFunction(loginHydrationReady, undefined, { timeout: 30000 }).catch(() => { if (!state.stopped) throw new Error("LOGIN_FORM_HYDRATION_NOT_PROVEN"); }),
      stopped,
    ]);
    if (state.stopped) return;
    requireCheck(await page.evaluate(loginHydrationReady), "LOGIN_FORM_HYDRATION_NOT_PROVEN");
    state.hydrationCompleted = true;
    emit("CLIENT_HYDRATION_COMPLETED", "YES");
    emit("LOGIN_FIELDS_EMPTY", "YES");
    // Single local request-construction exercise, with EMPTY fields, not real credentials.
    // Native validation is disabled in this disposable DOM only; every POST is aborted.
    emit("EMPTY_FORM_CONSTRUCTION", "ENTERED");
    state.emptyFormConstruction = true;
    await page.evaluate(() => {
      const email = document.querySelector("input#email");
      const password = document.querySelector('input#password[type="password"]');
      const form = email?.form;
      const propsKey = form && Object.keys(form).find((key) => key.startsWith("__reactProps$"));
      if (!email || !password || !form || password.form !== form || email.value !== "" || password.value !== "" || !propsKey || typeof form[propsKey]?.action !== "function") throw new Error("LOCAL_HYDRATED_EMPTY_FORM_UNAVAILABLE");
      email.value = ""; password.value = "";
      form.noValidate = true;
      form.requestSubmit();
    });
    let timer;
    try { await Promise.race([stopped, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("NO_REQUEST_CAPTURED")), 10000); })]); }
    finally { clearTimeout(timer); }
  } finally {
    state.stopped = true;
    oidc.token = "";
    if (context) await context.close();
    if (browser) await browser.close();
    if (proxy) await proxy.close();
    emit("FIRST_REFUSAL_CAPTURED", state.firstRefusal ? "YES" : "NO");
    emit("FIRST_AUTH_RELEVANT_REQUEST_CAPTURED", state.firstRefusal?.authenticationRelevant ? "YES" : "NO");
    emit("TOOLBAR_NONFATAL_BLOCK_COUNT", state.irrelevantBlockCount);
    emit("RSC_NONFATAL_BLOCK_COUNT", state.rscNonfatalBlockCount);
    if (forgotCaptureOnce) emit("FORGOT_NONFATAL_BLOCK_COUNT", state.forgotNonfatalBlockCount);
    emit("HYDRATED_AUTH_REQUEST_CAPTURED", state.firstRefusal?.hydratedAuthRequestCaptured ? "YES" : "NO");
    emit("LOGIN_POST_TRANSMITTED", "NO");
    if (syntheticSubmitOnce) emit("SYNTHETIC_SUBMIT_INVOCATION_COUNT", state.syntheticSubmitCount);
    if (rscMetadataOnly) {
      emit("RSC_METADATA_CAPTURED", state.firstRefusal?.rscMetadata ? "YES" : "NO");
      emit("LOGIN_ATTEMPTED", "NO");
    }
    if (forgotMetadataOnly) {
      emit("FORGOT_METADATA_CAPTURED", state.firstRefusal?.forgotPasswordMetadata ? "YES" : "NO");
      emit("FORGOT_ABORT_CONFIRMED", state.firstRefusal?.forgotPasswordAbortConfirmed === true ? "YES" : "NO");
      emit("LOGIN_ATTEMPTED", "NO");
    }
    if (forgotCaptureOnce) {
      emit("FORGOT_ABORT_CONFIRMED", state.forgotIrrelevantRefusal?.forgotPasswordAbortConfirmed === true ? "YES" : "NO");
      emit("LOGIN_ATTEMPTED", "NO");
    }
    emit("CREDENTIAL_RETRIEVAL", "NOT_RUN");
    emit("PRODUCTION_REQUEST_COUNT", "0");
    emit("GATE", "BLOCKED");
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    // Refusal codes only. Never print provider output, Playwright stacks or raw errors.
    const code = safeCode(error);
    const localCodes = new Set(["CAPTURE_ARGUMENTS_INVALID", "UNAPPROVED_PROCESS_OVERRIDE", "UNAUTHENTICATED_PROTECTION_NOT_PROVEN", "TOOLBAR_PRODUCTION_EXCLUSION_UNVERIFIED", "BROAD_AUTH_HEADER_BLOCKED", "LOGIN_PAGE_LOAD_FAILED", "LOGIN_PAGE_TARGET_MISMATCH", "LOGIN_FORM_HYDRATION_NOT_PROVEN", "RSC_METADATA_REQUEST_NOT_OBSERVED", "FORGOT_METADATA_REQUEST_NOT_OBSERVED", "NO_REQUEST_CAPTURED", "EMPTY_SUBMIT_PREFLIGHT_TIMEOUT", "EMPTY_SUBMIT_NONBOOLEAN_METADATA", "EMPTY_SUBMIT_INTERCEPTION_OR_PREFLIGHT_UNVERIFIED", "EMPTY_SUBMIT_PAGE_MISMATCH"]);
    emit("FAILURE", code !== "UNEXPECTED_RUNNER_ERROR" ? code : syntheticFailureCode(error) ?? (localCodes.has(error.message) ? error.message : "CAPTURE_LOCAL_FAILURE"));
    process.exitCode = 1;
  });
}
