// Diagnostic-only one-way transport. No network grant or nonfatal exception.
import { PIN, assertProof } from "../phase6/hosted-auth-smoke.mjs";
import { forgotRequestMetadata, isExactForgotRequest } from "./protected-preview-forgot-metadata.mjs";

const BINDING = "__p7PassiveForgotObservation";
const KEYS = ["mainFrame", "pageStillLogin", "isActive", "hasBeenActive", "userGestureSeen", "anyClickSeen", "forgotLinkClickSeen", "focusSeen", "keyboardSeen", "pointerSeen", "formSubmitSeen", "navigationObserverAvailable", "routeNavigationSeen", "programmaticNavigationSeen", "observationError", "forgotLinkPresent", "forgotLinkVisible", "forgotLinkReactBound", "forgotLinkPrefetchNotDisabled", "loginHydrated", "documentLoading"];
const booleans = (raw) => Object.fromEntries(KEYS.map((key) => [key, typeof raw?.[key] === "boolean" ? raw[key] : null]));

// Page-domain pre-document injection, not Playwright exposeBinding/evaluate.
// The native CDP binding emits a notification and has NO reply evaluation.
export function passiveForgotObserver({ origin, binding }) {
  if (window !== top || location.href !== `${origin}/login`) return;
  const seen = { userGestureSeen: false, anyClickSeen: false, forgotLinkClickSeen: false, focusSeen: false, keyboardSeen: false, pointerSeen: false, formSubmitSeen: false, routeNavigationSeen: false, programmaticNavigationSeen: false, observationError: false };
  const groups = { anyClickSeen: ["click", "dblclick"], focusSeen: ["focus", "focusin", "blur", "focusout"], keyboardSeen: ["keydown", "keyup", "keypress"], pointerSeen: ["pointerdown", "pointerup", "pointermove", "mousedown", "mouseup", "mousemove", "mouseover", "touchstart", "touchend"], formSubmitSeen: ["submit"] };
  for (const [key, types] of Object.entries(groups)) for (const type of types) addEventListener(type, (event) => {
    seen[key] = true; // Synthetic events also contaminate classification.
    if (event.isTrusted && key !== "formSubmitSeen") seen.userGestureSeen = true;
    if (type === "click") {
      try { seen.forgotLinkClickSeen ||= event.composedPath().some((element) => element instanceof HTMLAnchorElement && element.href === `${origin}/forgot-password`); }
      catch { seen.observationError = true; }
    }
  }, true);
  const navigationObservable = typeof window.navigation?.addEventListener === "function";
  if (navigationObservable) window.navigation.addEventListener("navigate", (event) => {
    try {
      if (event.destination.url !== `${origin}/login`) {
        seen.routeNavigationSeen = true;
        if (event.userInitiated === false) seen.programmaticNavigationSeen = true;
        else if (event.userInitiated !== true) seen.observationError = true;
      }
      if (event.formData != null) seen.formSubmitSeen = true;
    } catch { seen.observationError = true; }
  });
  const snapshot = (phase) => ({ phase, mainFrame: window === top, pageStillLogin: location.href === `${origin}/login`,
    isActive: typeof navigator.userActivation?.isActive === "boolean" ? navigator.userActivation.isActive : null,
    hasBeenActive: typeof navigator.userActivation?.hasBeenActive === "boolean" ? navigator.userActivation.hasBeenActive : null,
    navigationObserverAvailable: navigationObservable, ...seen,
    forgotLinkPresent: false, forgotLinkVisible: false, forgotLinkReactBound: false, forgotLinkPrefetchNotDisabled: false,
    loginHydrated: false, documentLoading: document.readyState === "loading",
  });
  const report = (record) => window[binding](JSON.stringify(record));
  report(snapshot("BASELINE"));
  const originalFetch = window.fetch;
  let recorded = false;
  window.fetch = function(input, ...rest) {
    let url;
    try {
      const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input instanceof Request ? input.url : null;
      if (raw !== null) url = new URL(raw, document.baseURI);
    } catch { seen.observationError = true; }
    if (!recorded && url?.origin === origin && url.pathname === "/forgot-password" && !url.username && !url.password && !url.port && !url.hash && [...url.searchParams.keys()].length === 1 && url.searchParams.has("_rsc")) {
      recorded = true;
      const record = snapshot("BEFORE_FORGOT_FETCH");
      try {
        const links = [...document.querySelectorAll('a[href="/forgot-password"]')].filter((element) => element.href === `${origin}/forgot-password`);
        const link = links.length === 1 ? links[0] : null;
        const propsKey = link && Object.keys(link).find((key) => key.startsWith("__reactProps$"));
        const props = propsKey ? link[propsKey] : null;
        const rect = link?.getBoundingClientRect(); const style = link && getComputedStyle(link);
        record.forgotLinkPresent = !!link;
        record.forgotLinkVisible = !!rect && rect.width > 0 && rect.height > 0 && style?.visibility !== "hidden" && style?.display !== "none";
        record.forgotLinkReactBound = !!props && props.href === "/forgot-password" && typeof props.onClick === "function";
        record.forgotLinkPrefetchNotDisabled = !!props && props.prefetch !== false;
        // Read hydration types/booleans only. Never read any input value.
        const form = document.querySelector("input#email")?.form;
        const formPropsKey = form && Object.keys(form).find((key) => key.startsWith("__reactProps$"));
        const fiberKey = form && Object.keys(form).find((key) => key.startsWith("__reactFiber$"));
        let fiber = fiberKey ? form[fiberKey] : null;
        for (let depth = 0; fiber && depth < 200; depth++, fiber = fiber.return) {
          if (fiber.tag === 3) {
            record.loginHydrated = fiber.stateNode?.current?.memoizedState?.isDehydrated === false && !!formPropsKey && typeof form[formPropsKey]?.action === "function";
            break;
          }
        }
      } catch { record.observationError = true; }
      report(record); // No await, callback evaluation, field access or user action.
    }
    return originalFetch.call(this, input, ...rest);
  };
}

// Only the approved immutable target can be configured by the hosted runner.
export async function attachPassiveForgotObserver(page, proof, onBaseline = () => {}) {
  assertProof(proof);
  return attachTransport(await page.context().newCDPSession(page), PIN.url, onBaseline);
}

// Protocol adapter separated for offline test doubles; never grants URL access.
export async function attachTransport(cdp, origin, onBaseline = () => {}) {
  if (origin !== PIN.url && origin !== "http://127.0.0.1") throw new Error("PASSIVE_OBSERVER_TARGET_REFUSED");
  const contexts = new Map(); let mainFrameId; let baseline; let before; let network;
  let sequence = 0; let duplicate = false; let observationError = false;
  let resolveComplete;
  const complete = new Promise((accept) => { resolveComplete = accept; });
  const notify = () => { if (baseline && before && network) resolveComplete(); };
  cdp.on("Page.frameNavigated", ({ frame }) => {
    if (!frame.parentId && frame.url === `${origin}/login`) mainFrameId = frame.id;
  });
  cdp.on("Runtime.executionContextCreated", ({ context }) => {
    if (context.origin === origin && context.auxData?.isDefault === true) contexts.set(context.id, context.auxData.frameId);
  });
  cdp.on("Runtime.executionContextDestroyed", ({ executionContextId }) => { contexts.delete(executionContextId); });
  cdp.on("Runtime.bindingCalled", (event) => {
    if (event.name !== BINDING) return;
    try {
      if (typeof event.payload !== "string" || event.payload.length > 4096) { observationError = true; return; }
      const raw = JSON.parse(event.payload);
      if (!["BASELINE", "BEFORE_FORGOT_FETCH"].includes(raw.phase)) { observationError = true; return; }
      const entry = { data: booleans(raw), contextId: event.executionContextId, sequence: ++sequence };
      if (raw.phase === "BASELINE") {
        if (baseline) duplicate = true;
        else { baseline = entry; onBaseline(entry.data); }
      } else if (before) duplicate = true;
      else before = entry;
      notify();
    } catch { observationError = true; }
  });
  cdp.on("Network.requestWillBeSent", (event) => {
    try {
      const url = new URL(event.request.url);
      if (url.origin !== origin || url.pathname !== "/forgot-password" || event.request.method !== "GET" || url.username || url.password || url.port || url.hash || [...url.searchParams.keys()].length !== 1 || !url.searchParams.has("_rsc")) return;
      if (network) { duplicate = true; return; }
      const frames = []; let stack = event.initiator?.stack;
      for (let depth = 0; stack && depth < 8; depth++, stack = stack.parent) frames.push(...(stack.callFrames ?? []).slice(0, 64));
      const fromApprovedScript = frames.some((frame) => { try { const script = new URL(frame.url); return script.origin === origin && script.pathname.startsWith("/_next/static/") && !script.username && !script.password && !script.port; } catch { return false; } });
      const foreignScript = frames.some((frame) => { try { const script = new URL(frame.url); return ["https:", "http:"].includes(script.protocol) && script.origin !== origin; } catch { return false; } });
      network = { rawUrl: event.request.url, frameId: event.frameId, sequence: ++sequence,
        scriptInitiator: event.initiator?.type === "script", approvedScriptInInitiator: fromApprovedScript,
        foreignScriptInInitiator: foreignScript,
        // CDP specifies false when hasUserGesture is omitted.
        browserHasUserGesture: event.hasUserGesture === undefined ? false : event.hasUserGesture,
      };
      notify();
    } catch { observationError = true; }
  });
  await cdp.send("Page.enable"); // Required before pre-document observer registration.
  await cdp.send("Runtime.enable");
  await cdp.send("Network.enable");
  await cdp.send("Runtime.addBinding", { name: BINDING });
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: `(${passiveForgotObserver.toString()})(${JSON.stringify({ origin, binding: BINDING })})`, runImmediately: false, includeCommandLineAPI: false });
  return {
    async forRequest(request) {
      // Only wait for metadata belonging to the already-paused request, never
      // for another browser request. Missing metadata remains UNKNOWN/fatal.
      let timer;
      try { await Promise.race([complete, new Promise((accept) => { timer = setTimeout(accept, 250); })]); }
      finally { clearTimeout(timer); }
      return {
        baseline: baseline?.data ?? null, before: before?.data ?? null,
        transportComplete: !observationError && !duplicate && !!baseline && !!before && !!network,
        sameMainFrame: !!mainFrameId && contexts.get(baseline?.contextId) === mainFrameId && contexts.get(before?.contextId) === mainFrameId && network?.frameId === mainFrameId,
        requestCorrelationVerified: !!network && network.rawUrl === request.url() && baseline?.sequence < before?.sequence && before?.sequence < network.sequence,
        scriptInitiator: network?.scriptInitiator ?? null,
        approvedScriptInInitiator: network?.approvedScriptInInitiator ?? null,
        foreignScriptInInitiator: network?.foreignScriptInInitiator ?? null,
        browserHasUserGesture: typeof network?.browserHasUserGesture === "boolean" ? network.browserHasUserGesture : null,
      };
    },
    baseline: () => baseline?.data ?? null,
  };
}

const CLEAN_FALSE = ["isActive", "hasBeenActive", "userGestureSeen", "anyClickSeen", "forgotLinkClickSeen", "focusSeen", "keyboardSeen", "pointerSeen", "formSubmitSeen", "routeNavigationSeen", "programmaticNavigationSeen", "observationError"];
const cleanSnapshot = (snapshot) => snapshot?.mainFrame === true && snapshot?.pageStillLogin === true && snapshot?.navigationObserverAvailable === true && CLEAN_FALSE.every((key) => snapshot[key] === false);

export function passiveForgotMetadata(proof, request, facts, evidence) {
  if (!isExactForgotRequest(proof, request.url(), request.method(), request.resourceType())) return null;
  const before = evidence?.before;
  const adapted = { ...before, observerReady: evidence?.transportComplete === true,
    userActivationSeen: before?.hasBeenActive };
  const metadata = forgotRequestMetadata(proof, request, { ...facts, observation: adapted, observationFrameMatches: evidence?.sameMainFrame === true });
  const uncontaminated = cleanSnapshot(evidence?.baseline) && cleanSnapshot(before);
  const causal = uncontaminated && evidence?.transportComplete === true && evidence?.sameMainFrame === true && evidence?.requestCorrelationVerified === true &&
    evidence?.scriptInitiator === true && evidence?.approvedScriptInInitiator === true && evidence?.foreignScriptInInitiator === false && evidence?.browserHasUserGesture === false &&
    facts.loginResponseObserved === true && metadata.frameworkPrefetchInitiatorVerified === true && metadata.contentLengthPresent === false;
  return { ...metadata,
    activationBaseline: { isActive: evidence?.baseline?.isActive ?? null, hasBeenActive: evidence?.baseline?.hasBeenActive ?? null },
    activationBeforeRequest: { isActive: before?.isActive ?? null, hasBeenActive: before?.hasBeenActive ?? null },
    focusAssociated: before?.focusSeen ?? null, keyboardAssociated: before?.keyboardSeen ?? null, pointerAssociated: before?.pointerSeen ?? null,
    passiveTransportComplete: evidence?.transportComplete === true, passiveRequestCorrelationVerified: evidence?.requestCorrelationVerified === true,
    approvedScriptInInitiator: evidence?.approvedScriptInInitiator ?? null, browserHasUserGesture: evidence?.browserHasUserGesture ?? null,
    runnerSyntheticActivationExcluded: uncontaminated && evidence?.transportComplete === true,
    userInteractionExcluded: uncontaminated, automaticallyInitiatedDuringHydration: causal,
    frameworkPrefetchInitiatorVerified: causal, authenticationPurposeExcluded: causal,
    purposeClassification: causal ? "AUTOMATIC_FRAMEWORK_PREFETCH" : "UNKNOWN",
    // Even a positive diagnostic classification cannot grant nonfatal treatment.
  };
}
