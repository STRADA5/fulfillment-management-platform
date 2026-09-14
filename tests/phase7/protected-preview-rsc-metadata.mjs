// Presence/structure diagnostics only. This module never allows or sends a request.
import { PIN, assertProof } from "../phase6/hosted-auth-smoke.mjs";

// Next 16.3.1 createFetch adds x-deployment-id from getDeploymentId().
// This is name-only framework identification, never authentication authority or
// deployment proof. The value is neither supplied here nor inspected/output.
const FRAMEWORK_NAMES = new Set(["rsc", "next-router-prefetch", "next-router-segment-prefetch", "next-router-state-tree", "next-url", "x-deployment-id"]);
const ORDINARY_NAMES = new Set(["accept", "accept-encoding", "accept-language", "cache-control", "connection", "host", "pragma", "priority", "referer", "origin", "user-agent", "dnt", "sec-gpc", "sec-ch-ua", "sec-ch-ua-mobile", "sec-ch-ua-platform", "sec-fetch-dest", "sec-fetch-mode", "sec-fetch-site", "sec-fetch-user", "upgrade-insecure-requests", "content-length"]);
const credentialName = (name) => /authorization|cookie|token|api[-_]?key|secret|credential|password|protection-bypass/i.test(name);

export function isExactRootRscRequest(proof, raw, method, resourceType) {
  try {
    assertProof(proof);
    const url = new URL(raw);
    const queryNames = [...url.searchParams.keys()];
    return url.origin === PIN.url && url.protocol === "https:" && url.hostname === new URL(PIN.url).hostname &&
      !url.username && !url.password && !url.port && !url.hash && url.pathname === "/" &&
      queryNames.length === 1 && queryNames[0] === "_rsc" && method === "GET" && resourceType === "fetch";
  } catch { return false; }
}

export function rootRscMetadata(proof, request, facts) {
  if (!isExactRootRscRequest(proof, request.url(), request.method(), request.resourceType())) return null;
  const url = new URL(request.url());
  const knownHeaders = facts.headersKnown === true && Array.isArray(facts.headerNames) && facts.headerNames.every((name) => typeof name === "string");
  const names = knownHeaders ? facts.headerNames.map((name) => name.toLowerCase()) : [];
  const present = (name) => knownHeaders ? names.includes(name) : null;
  let mainFrame = null;
  try {
    if (facts.frame && facts.framePage && facts.page) mainFrame = facts.framePage === facts.page && facts.frame === facts.page.mainFrame();
  } catch { /* unknown, never a positive proof */ }
  let initiatingOrigin = "UNKNOWN"; let initiatingPath = "UNKNOWN";
  try {
    const initiating = new URL(facts.initiatingPage);
    // Do not output any unexpected page URL, path, query or userinfo.
    if (initiating.origin === PIN.url) {
      initiatingOrigin = PIN.url;
      if (initiating.pathname === "/login") initiatingPath = "/login";
    }
  } catch { /* unknown */ }
  let bodyPresent = null;
  // Exact root GET/fetch only; null-presence check, never inspect/decode/copy bytes.
  try { bodyPresent = request.postDataBuffer() !== null; } catch { /* unknown */ }
  let crossOriginRedirect = null;
  try {
    let previous = request.redirectedFrom();
    crossOriginRedirect = false;
    for (let count = 0; previous !== null; count++) {
      if (count === 16) { crossOriginRedirect = null; break; }
      if (new URL(previous.url()).origin !== PIN.url) { crossOriginRedirect = true; break; }
      previous = previous.redirectedFrom();
    }
  } catch { crossOriginRedirect = null; }
  const authorizationPresent = present("authorization");
  const cookiePresent = present("cookie");
  const otherCredentialPresent = knownHeaders ? names.some((name) => name !== "authorization" && name !== "cookie" && credentialName(name)) : null;
  const unknownHeaderPresent = knownHeaders ? names.some((name) => !ORDINARY_NAMES.has(name) && !FRAMEWORK_NAMES.has(name) && name !== "next-action" && !credentialName(name)) : null;
  const rscPresent = present("rsc");
  const prefetchPresent = present("next-router-prefetch");
  const frameworkPresent = knownHeaders ? names.some((name) => ["next-router-state-tree", "next-router-segment-prefetch", "next-url"].includes(name)) : null;
  const serverAction = present("next-action");
  const navigation = typeof facts.navigation === "boolean" ? facts.navigation : null;
  const redirected = typeof facts.redirected === "boolean" ? facts.redirected : null;
  const nonMutationMethod = ["GET", "HEAD"].includes(request.method());
  const formSubmission = navigation === false ? false : null;
  const authenticationApi = /\/(?:auth|api)(?:\/|$)/i.test(url.pathname);
  const supabaseAuth = url.hostname.endsWith(".supabase.co") && /^\/auth(?:\/|$)/i.test(url.pathname);
  const frameworkVerified = rscPresent === true && prefetchPresent === true && frameworkPresent === true;
  const credentialAbsenceVerified = knownHeaders && authorizationPresent === false && cookiePresent === false && otherCredentialPresent === false && unknownHeaderPresent === false && !url.username && !url.password && bodyPresent === false;
  const anonymousVerified = facts.freshIsolatedContext === true && credentialAbsenceVerified;
  const nonAuthenticationVerified = frameworkVerified && anonymousVerified && nonMutationMethod && navigation === false && formSubmission === false && redirected === false && crossOriginRedirect === false && serverAction === false && !authenticationApi && !supabaseAuth;
  return {
    initiatingOrigin, initiatingPath, requestMethod: request.method(), resolvedOrigin: url.origin, resolvedPathname: url.pathname,
    resourceType: request.resourceType(), initiatorType: "FETCH_API",
    mainFrameInitiator: mainFrame, initiatingPathIsLogin: facts.initiatingPage === `${PIN.url}/login`,
    sameApprovedOrigin: url.origin === PIN.url, sameApprovedDeployment: true, methodGetOrHead: nonMutationMethod,
    requestBodyPresent: bodyPresent, contentLengthHeaderPresent: present("content-length"),
    authorizationHeaderPresent: authorizationPresent, cookieHeaderPresent: cookiePresent, otherCredentialHeaderPresent: otherCredentialPresent,
    headerMetadataComplete: knownHeaders, unclassifiedHeaderPresent: unknownHeaderPresent,
    frameworkDeploymentHeaderPresent: present("x-deployment-id"),
    rscMarkerPresent: rscPresent, prefetchMarkerPresent: prefetchPresent, routerFrameworkMarkerPresent: frameworkPresent, serverActionMarkerPresent: serverAction,
    frameworkHeaderNames: names.filter((name) => FRAMEWORK_NAMES.has(name)),
    navigationRequest: navigation, documentRequest: request.resourceType() === "document", formSubmission,
    fetchOrXhr: ["fetch", "xhr"].includes(request.resourceType()), serverAction, redirectAssociated: redirected, crossOriginRedirect,
    mutationCapableMethod: !nonMutationMethod, authenticationApi, supabaseAuth,
    queryPresent: !!url.search, fragmentPresent: !!url.hash, userinfoPresent: !!url.username || !!url.password, nondefaultPortPresent: !!url.port,
    freshIsolatedContext: facts.freshIsolatedContext === true,
    anonymousVerified, frameworkPrefetchVerified: frameworkVerified, bodyAbsenceVerified: bodyPresent === false, credentialAbsenceVerified,
    nonNavigationVerified: navigation === false, nonRedirectVerified: redirected === false && crossOriginRedirect === false,
    nonMutationVerified: nonMutationMethod && bodyPresent === false && serverAction === false && formSubmission === false,
    nonServerActionVerified: serverAction === false, nonAuthenticationVerified,
    // Diagnostic only: never turn these predicates into an access/continuation rule here.
    allReviewedConditionsProven: mainFrame === true && facts.initiatingPage === `${PIN.url}/login` && nonAuthenticationVerified,
  };
}

export async function waitForRscMetadataStop(state, stopped, timeoutMs = 30000) {
  // No DOM inspection, hydration polling, request construction or authentication.
  if (state.stopped) return;
  let timer;
  try {
    await Promise.race([stopped, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("RSC_METADATA_REQUEST_NOT_OBSERVED")), timeoutMs); })]);
  } finally { clearTimeout(timer); }
}
