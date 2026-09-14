// Exact-path presence diagnostics only. No allow/nonfatal decision lives here.
import { PIN, assertProof } from "../phase6/hosted-auth-smoke.mjs";

const FRAMEWORK = new Set(["rsc", "next-router-prefetch", "next-router-segment-prefetch", "next-router-state-tree", "next-url", "x-deployment-id"]);
const ORDINARY = new Set(["accept", "accept-encoding", "accept-language", "cache-control", "connection", "host", "pragma", "priority", "referer", "origin", "user-agent", "dnt", "sec-gpc", "sec-ch-ua", "sec-ch-ua-mobile", "sec-ch-ua-platform", "sec-fetch-dest", "sec-fetch-mode", "sec-fetch-site", "sec-fetch-user", "upgrade-insecure-requests", "content-length"]);
const credentialName = (name) => /authorization|cookie|token|api[-_]?key|secret|credential|password|protection-bypass/i.test(name);
const OBSERVATION_KEYS = ["observerReady", "mainFrame", "pageStillLogin", "userGestureSeen", "userActivationSeen", "anyClickSeen", "forgotLinkClickSeen", "formSubmitSeen", "navigationObserverAvailable", "routeNavigationSeen", "programmaticNavigationSeen", "observationError", "forgotLinkPresent", "forgotLinkVisible", "forgotLinkReactBound", "forgotLinkPrefetchNotDisabled", "loginHydrated", "documentLoading"];

export function sanitizeForgotObservation(raw) {
  return Object.fromEntries(OBSERVATION_KEYS.map((key) => [key, typeof raw?.[key] === "boolean" ? raw[key] : null]));
}

export function isExactForgotRequest(proof, raw, method, resourceType) {
  try {
    assertProof(proof);
    const url = new URL(raw);
    const keys = [...url.searchParams.keys()];
    return url.origin === PIN.url && url.protocol === "https:" && url.hostname === new URL(PIN.url).hostname &&
      !url.username && !url.password && !url.port && !url.hash && url.pathname === "/forgot-password" &&
      keys.length === 1 && keys[0] === "_rsc" && method === "GET" && resourceType === "fetch";
  } catch { return false; }
}

// Runs before application scripts in the fresh, isolated browser context.
// Observe events and exact-fetch construction; never click, navigate, submit,
// change prefetch, inspect form values, or serialize body/header/stack contents.
export function installForgotMetadataObserver({ origin }) {
  const events = { userGestureSeen: false, anyClickSeen: false, forgotLinkClickSeen: false, formSubmitSeen: false, routeNavigationSeen: false, programmaticNavigationSeen: false, observationError: false };
  for (const type of ["pointerdown", "mousedown", "touchstart", "keydown", "click"]) {
    addEventListener(type, (event) => {
      if (event.isTrusted) events.userGestureSeen = true;
      if (type === "click") {
        events.anyClickSeen = true;
        try { events.forgotLinkClickSeen ||= event.composedPath().some((node) => node instanceof HTMLAnchorElement && node.href === `${origin}/forgot-password`); }
        catch { events.observationError = true; }
      }
    }, true);
  }
  addEventListener("submit", () => { events.formSubmitSeen = true; }, true);
  const navigationObserverAvailable = typeof window.navigation?.addEventListener === "function";
  if (navigationObserverAvailable) window.navigation.addEventListener("navigate", (event) => {
    try {
      // Next may initialize history on /login; only actual URL transitions count.
      if (event.destination.url !== `${origin}/login`) {
        events.routeNavigationSeen = true;
        if (event.userInitiated === false) events.programmaticNavigationSeen = true;
        else if (event.userInitiated !== true) events.observationError = true;
      }
      if (event.formData !== null && event.formData !== undefined) events.formSubmitSeen = true;
    } catch { events.observationError = true; }
  });
  const originalFetch = window.fetch;
  window.fetch = async function(input, ...rest) {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input instanceof Request ? input.url : null;
    let url;
    try { if (raw !== null) url = new URL(raw, document.baseURI); } catch { /* ordinary wrapper handles refusal */ }
    if (url?.origin === origin && url.pathname === "/forgot-password" && !url.username && !url.password && !url.port && !url.hash && [...url.searchParams.keys()].length === 1 && url.searchParams.has("_rsc")) {
      let dom = { forgotLinkPresent: null, forgotLinkVisible: null, forgotLinkReactBound: null, forgotLinkPrefetchNotDisabled: null, loginHydrated: null };
      try {
        const links = [...document.querySelectorAll('a[href="/forgot-password"]')].filter((element) => element.href === `${origin}/forgot-password`);
        const link = links.length === 1 ? links[0] : null;
        const propsKey = link && Object.keys(link).find((key) => key.startsWith("__reactProps$"));
        const props = propsKey ? link[propsKey] : null;
        const rect = link?.getBoundingClientRect();
        const style = link && getComputedStyle(link);
        const form = document.querySelector("input#email")?.form;
        const formPropsKey = form && Object.keys(form).find((key) => key.startsWith("__reactProps$"));
        const fiberKey = form && Object.keys(form).find((key) => key.startsWith("__reactFiber$"));
        let fiber = fiberKey ? form[fiberKey] : null;
        let hydrated = false;
        for (let depth = 0; fiber && depth < 200; depth++, fiber = fiber.return) {
          if (fiber.tag === 3) { hydrated = fiber.stateNode?.current?.memoizedState?.isDehydrated === false; break; }
        }
        dom = {
          forgotLinkPresent: !!link,
          forgotLinkVisible: !!rect && rect.width > 0 && rect.height > 0 && style?.visibility !== "hidden" && style?.display !== "none",
          forgotLinkReactBound: !!props && props.href === "/forgot-password" && typeof props.onClick === "function",
          forgotLinkPrefetchNotDisabled: !!props && props.prefetch !== false,
          loginHydrated: hydrated && !!formPropsKey && typeof form[formPropsKey]?.action === "function",
        };
      } catch { events.observationError = true; }
      await window.__p7ForgotMetadata({
        ...events, ...dom, observerReady: true, mainFrame: window === window.top,
        pageStillLogin: location.href === `${origin}/login`, navigationObserverAvailable,
        userActivationSeen: typeof navigator.userActivation?.hasBeenActive === "boolean" ? navigator.userActivation.hasBeenActive : null,
        documentLoading: document.readyState === "loading",
      });
    }
    return originalFetch.call(this, input, ...rest);
  };
}

export function forgotRequestMetadata(proof, request, facts) {
  if (!isExactForgotRequest(proof, request.url(), request.method(), request.resourceType())) return null;
  const url = new URL(request.url());
  const known = facts.headersKnown === true && Array.isArray(facts.headerNames) && facts.headerNames.every((name) => typeof name === "string");
  const names = known ? facts.headerNames.map((name) => name.toLowerCase()) : [];
  const present = (name) => known ? names.includes(name) : null;
  const observation = sanitizeForgotObservation(facts.observation);
  let mainFrame = null; let serviceWorker = null; let bodyPresent = null; let crossOriginRedirect = null;
  try { if (facts.frame && facts.framePage && facts.page) mainFrame = facts.framePage === facts.page && facts.frame === facts.page.mainFrame(); } catch { /* unknown */ }
  try { serviceWorker = request.serviceWorker() !== null; } catch { /* unknown */ }
  // Null-presence check only, scoped to this exact GET/fetch. Never decode bytes.
  try { bodyPresent = request.postDataBuffer() !== null; } catch { /* unknown */ }
  try {
    let previous = request.redirectedFrom(); crossOriginRedirect = false;
    for (let depth = 0; previous !== null; depth++) {
      if (depth === 16) { crossOriginRedirect = null; break; }
      if (new URL(previous.url()).origin !== PIN.url) { crossOriginRedirect = true; break; }
      previous = previous.redirectedFrom();
    }
  } catch { crossOriginRedirect = null; }
  const nav = typeof facts.navigation === "boolean" ? facts.navigation : null;
  const redirected = typeof facts.redirected === "boolean" ? facts.redirected : null;
  const otherCredential = known ? names.some((name) => name !== "authorization" && name !== "cookie" && credentialName(name)) : null;
  const unknownHeader = known ? names.some((name) => !ORDINARY.has(name) && !FRAMEWORK.has(name) && name !== "next-action" && !credentialName(name)) : null;
  const observerComplete = OBSERVATION_KEYS.every((key) => typeof observation[key] === "boolean") && observation.observerReady === true && observation.observationError === false && observation.mainFrame === true && observation.pageStillLogin === true && facts.observationFrameMatches === true;
  const interactionExcluded = observerComplete && observation.userGestureSeen === false && observation.userActivationSeen === false && observation.anyClickSeen === false && observation.forgotLinkClickSeen === false;
  const navigationExcluded = observerComplete && observation.navigationObserverAvailable === true && observation.routeNavigationSeen === false && observation.programmaticNavigationSeen === false && nav === false && redirected === false && crossOriginRedirect === false;
  const anonymous = facts.freshIsolatedContext === true && known && present("authorization") === false && present("cookie") === false && otherCredential === false && unknownHeader === false && bodyPresent === false;
  const framework = present("rsc") === true && present("next-router-prefetch") === true && (present("next-router-segment-prefetch") === true || present("next-router-state-tree") === true);
  const noMutation = bodyPresent === false && present("next-action") === false && observerComplete && observation.formSubmitSeen === false && nav === false;
  const automatic = framework && interactionExcluded && navigationExcluded && observation.loginHydrated === true && facts.passiveOnly === true && mainFrame === true && serviceWorker === false && noMutation && anonymous;
  return {
    requestMethod: "GET", resolvedOrigin: url.origin, resolvedPathname: url.pathname, resourceType: "fetch", initiatorType: "FETCH_API",
    mainFrameRequest: mainFrame, mainFrameInitiator: mainFrame, navigationRequest: nav, documentRequest: false, fetchOrXhr: true,
    formSubmission: observerComplete && nav === false ? observation.formSubmitSeen : null,
    userGestureAssociated: observation.userGestureSeen, linkClickAssociated: observation.forgotLinkClickSeen,
    programmaticNavigation: observerComplete && observation.navigationObserverAvailable ? observation.programmaticNavigationSeen : null,
    automaticallyInitiatedDuringHydration: automatic,
    // Presence + framework hints corroborate the visible Link. They do not record
    // a causal JavaScript call-stack/DOM initiator; never invent that attribution.
    initiatingElementIsForgotPasswordLink: null,
    frameworkPrefetchInitiatorVerified: automatic,
    prefetchAttributeOrFrameworkHint: present("next-router-prefetch"),
    rscMarkerPresent: present("rsc"), nextRouterPrefetchMarkerPresent: present("next-router-prefetch"),
    routerStateMarkerPresent: present("next-router-state-tree"), routerSegmentMarkerPresent: present("next-router-segment-prefetch"),
    serverActionMarkerPresent: present("next-action"), nextActionHeaderPresent: present("next-action"),
    requestBodyPresent: bodyPresent, contentLengthPresent: present("content-length"),
    authorizationHeaderPresent: present("authorization"), cookieHeaderPresent: present("cookie"), otherCredentialHeaderPresent: otherCredential,
    headerMetadataComplete: known, unclassifiedHeaderPresent: unknownHeader, frameworkHeaderNames: names.filter((name) => FRAMEWORK.has(name)),
    redirectAssociated: redirected, crossOriginRedirect, mutationCapable: noMutation ? false : null,
    authenticationApi: false, supabaseAuth: false, queryPresent: !!url.search, fragmentPresent: !!url.hash,
    userinfoPresent: !!url.username || !!url.password, nondefaultPortPresent: !!url.port,
    sameApprovedOrigin: true, sameApprovedDeployment: true, serviceWorker,
    observerComplete, observation, userInteractionExcluded: interactionExcluded, realNavigationExcluded: navigationExcluded,
    credentialPresenceExcluded: anonymous, mutationExcluded: noMutation,
    authenticationPurposeExcluded: automatic, purposeClassification: automatic ? "AUTOMATIC_NEXTJS_PREFETCH" : "UNKNOWN",
    // Review information only. The caller always aborts and stops.
  };
}

export async function waitForForgotMetadataStop(state, stopped, timeoutMs = 30000) {
  if (state.stopped) return;
  let timer;
  try { await Promise.race([stopped, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("FORGOT_METADATA_REQUEST_NOT_OBSERVED")), timeoutMs); })]); }
  finally { clearTimeout(timer); }
}
