// Observation only. No request allowance, control-policy decision, or page input.
export const FEEDBACK_RESOURCE = "https://vercel.live/_next-live/feedback/feedback.js";
const UNKNOWN = "UNKNOWN";
// Bookkeeping vocabulary only; these states never authorize a request.
export const AUTHENTICATION_LIFECYCLE = Object.freeze([
  "PRE_AUTHENTICATION", "AUTHENTICATION_SUBMIT_STARTED", "AUTHENTICATION_REQUEST_IN_FLIGHT",
  "AUTHENTICATION_SUCCEEDED", "POST_AUTHENTICATION",
]);
export const authenticationFeedbackPhase = phase => AUTHENTICATION_LIFECYCLE.slice(1, 4).includes(phase);
const read = (fn, fallback = UNKNOWN) => { try { return fn(); } catch { return fallback; } };
const bool = (value) => typeof value === "boolean" ? value : UNKNOWN;
const parse = (raw) => read(() => new URL(raw), null);
const BOOLEAN_FIELDS = ["EXACT_RESOURCE_IDENTITY", "AUTHENTICATION_PHASE", "BODY_PRESENT", "HEADERS_COMPLETE", "CREDENTIAL_METADATA_PRESENT", "SESSION_MATERIAL_PRESENT", "SESSION_REQUIRED_MATERIAL_PRESENT", "UNKNOWN_HEADERS_PRESENT", "STRUCTURAL_HEADERS_VALID", "SERVER_ACTION", "AUTHENTICATION_API", "SUPABASE_AUTH", "APPLICATION_API", "APPROVED_LOGIN_ACTION", "APPLICATION_API_REQUIRED_FOR_LOGIN", "AUTHENTICATION_RELEVANT", "NAVIGATION", "DOCUMENT", "FETCH_XHR", "FORM_SUBMISSION", "REDIRECT_TARGET", "SERVICE_WORKER", "APPROVED_INITIATING_LOGIN", "APPROVED_MAIN_FRAME", "CURRENT_PAGE_LOGIN", "PRODUCTION_TARGET", "PRODUCTION_EXCLUSION_VERIFIED", "INITIATOR_CORRELATED", "INITIATOR_APPROVED_SOURCE", "INITIATOR_FOREIGN_SOURCE", "INITIATOR_ATTRIBUTION_VERIFIED", "SINGLE_OCCURRENCE", "COUNT_COMPLETE"];
const INITIATORS = new Set(["PARSER", "SCRIPT", "PRELOAD", "PREFLIGHT", "SIGNED_EXCHANGE", "OTHER", UNKNOWN]);
// Diagnostic vocabulary copied from the existing script-header classifier.
// This is NOT used to permit a network request.
const ORDINARY_HEADERS = new Set(["accept", "accept-encoding", "accept-language", "cache-control", "connection", "host", "pragma", "priority", "referer", "origin", "user-agent", "dnt", "sec-gpc", "sec-ch-ua", "sec-ch-ua-mobile", "sec-ch-ua-platform", "sec-fetch-dest", "sec-fetch-mode", "sec-fetch-site", "sec-fetch-user", "upgrade-insecure-requests"]);

export function feedbackProductionRelationship(project, pin) {
  if (project?.id !== pin.projectId || project?.name !== pin.project || project?.accountId !== pin.teamId || !project.targets || typeof project.targets !== "object") return UNKNOWN;
  if (!Object.hasOwn(project.targets, "production")) return false;
  const production = project.targets.production;
  if (!production || typeof production.url !== "string" || !Array.isArray(production.alias) || !production.alias.every(x => typeof x === "string")) return UNKNOWN;
  const hosts = [production.url, ...production.alias];
  if (!hosts.every(x => /^[a-z0-9.-]+$/i.test(x))) return UNKNOWN;
  return hosts.some(x => x.toLowerCase() === "vercel.live");
}

export function feedbackHeaderMetadata(headers, pin, bodyPresent = UNKNOWN) {
  const result = { HEADERS_COMPLETE: false, CREDENTIAL_METADATA_PRESENT: UNKNOWN, SESSION_MATERIAL_PRESENT: UNKNOWN, SESSION_REQUIRED_MATERIAL_PRESENT: UNKNOWN, UNKNOWN_HEADERS_PRESENT: UNKNOWN, STRUCTURAL_HEADERS_VALID: UNKNOWN, SERVER_ACTION: UNKNOWN };
  if (!Array.isArray(headers) || !headers.every(x => typeof x?.name === "string")) return result;
  const names = headers.map(x => x.name.toLowerCase());
  const credential = names.some(x => /authorization|cookie|token|api[-_]?key|secret|credential|password|session|protection-bypass/i.test(x));
  const session = names.some(x => /authorization|cookie|token|session/i.test(x));
  const unknown = names.some(x => !ORDINARY_HEADERS.has(x));
  // Never copy header values. Only these structural values are compared privately.
  const structural = read(() => headers.every(x => {
    const name = x.name.toLowerCase();
    if (name === "referer") return x.value === `${pin.url}/login` || x.value === `${pin.url}/`;
    if (name === "origin") return x.value === pin.url;
    if (name === "host") return x.value === "vercel.live";
    return true;
  }), UNKNOWN);
  const clean = !unknown && structural === true;
  result.HEADERS_COMPLETE = true;
  result.UNKNOWN_HEADERS_PRESENT = unknown;
  result.STRUCTURAL_HEADERS_VALID = structural;
  result.CREDENTIAL_METADATA_PRESENT = credential ? true : clean ? false : UNKNOWN;
  result.SESSION_MATERIAL_PRESENT = session ? true : clean && bodyPresent === false ? false : UNKNOWN;
  // Presence never proves that session material is required by authentication.
  result.SESSION_REQUIRED_MATERIAL_PRESENT = result.SESSION_MATERIAL_PRESENT === false ? false : UNKNOWN;
  result.SERVER_ACTION = names.includes("next-action");
  return result;
}

export function feedbackTrafficMetadata(pin, facts) {
  const url = parse(facts.url);
  const exact = facts.url === FEEDBACK_RESOURCE;
  const navigation = bool(facts.navigation);
  const methodKnown = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"].includes(facts.method);
  const sameApplication = !!url && url.origin === pin.url;
  const authApi = url ? /\/(?:auth)(?:\/|$)/i.test(url.pathname) : UNKNOWN;
  const applicationApi = url ? sameApplication && /^\/api(?:\/|$)/i.test(url.pathname) : UNKNOWN;
  const supabaseAuth = url ? url.hostname === "nftufhffzlokryafcbku.supabase.co" && /^\/auth(?:\/|$)/i.test(url.pathname) : UNKNOWN;
  const login = url ? sameApplication && url.pathname === "/login" && facts.method === "POST" && facts.serverAction === true : UNKNOWN;
  const authRelevant = authApi === true || applicationApi === true || login === true || facts.serverAction === true || facts.credentialPresent === true || ["fetch", "xhr"].includes(facts.resourceType) || (methodKnown && !["GET", "HEAD"].includes(facts.method)) ? true : exact && facts.method === "GET" && facts.resourceType === "script" && facts.bodyPresent === false && facts.credentialPresent === false && facts.serverAction === false && navigation === false && facts.redirect === false ? false : UNKNOWN;
  return {
    EXACT_RESOURCE_IDENTITY: exact,
    AUTHENTICATION_PHASE: authenticationFeedbackPhase(facts.phase),
    AUTHENTICATION_API: authApi, SUPABASE_AUTH: supabaseAuth, APPLICATION_API: applicationApi,
    APPROVED_LOGIN_ACTION: login,
    APPLICATION_API_REQUIRED_FOR_LOGIN: login === true ? true : exact ? false : UNKNOWN,
    AUTHENTICATION_RELEVANT: authRelevant,
    NAVIGATION: navigation,
    DOCUMENT: typeof facts.resourceType === "string" && facts.resourceType !== UNKNOWN ? facts.resourceType === "document" : UNKNOWN,
    FETCH_XHR: typeof facts.resourceType === "string" && facts.resourceType !== UNKNOWN ? ["fetch", "xhr"].includes(facts.resourceType) : UNKNOWN,
    FORM_SUBMISSION: typeof navigation === "boolean" && methodKnown ? navigation && facts.method === "POST" : UNKNOWN,
    REDIRECT_TARGET: bool(facts.redirect),
  };
}

export function sanitizeFeedbackMetadata(raw = {}) {
  const record = Object.fromEntries(BOOLEAN_FIELDS.map(key => [key, bool(read(() => raw[key]))]));
  const count = read(() => raw.EXACT_OCCURRENCE);
  record.EXACT_OCCURRENCE = Number.isSafeInteger(count) && count > 0 && count <= 1000000 ? count : UNKNOWN;
  const authCount = read(() => raw.AUTHENTICATION_OCCURRENCE);
  record.AUTHENTICATION_OCCURRENCE = Number.isSafeInteger(authCount) && authCount > 0 && authCount <= 1000000 ? authCount : UNKNOWN;
  const phase = read(() => raw.ORIGINAL_LIFECYCLE_PHASE);
  record.ORIGINAL_LIFECYCLE_PHASE = AUTHENTICATION_LIFECYCLE.includes(phase) ? phase : UNKNOWN;
  const initiator = read(() => raw.INITIATOR_TYPE);
  record.INITIATOR_TYPE = INITIATORS.has(initiator) ? initiator : UNKNOWN;
  record.FIRST_FATAL_REFUSAL = true;
  record.NETWORK_DECISION = "BLOCKED";
  record.CAPTURE_CONTROL = "FATAL";
  return Object.freeze(record);
}
export function feedbackMetadataLines(raw) {
  return Object.entries(sanitizeFeedbackMetadata(raw)).map(([key, value]) => `P7_FEEDBACK_${key}=${typeof value === "boolean" ? String(value).toUpperCase() : value}`);
}

function initiatorMetadata(event, pin) {
  const types = { parser: "PARSER", script: "SCRIPT", preload: "PRELOAD", preflight: "PREFLIGHT", signedExchange: "SIGNED_EXCHANGE", other: "OTHER" };
  const type = Object.hasOwn(types, event.initiator?.type ?? "") ? types[event.initiator.type] : UNKNOWN;
  const sources = [];
  if (typeof event.initiator?.url === "string") sources.push(event.initiator.url);
  let stack = event.initiator?.stack;
  let incomplete = false;
  for (let depth = 0; stack && depth < 8; depth++, stack = stack.parent) {
    if (!Array.isArray(stack.callFrames)) { incomplete = true; break; }
    if (stack.callFrames.length > 64 || stack.parentId) incomplete = true;
    for (const frame of stack.callFrames.slice(0, 64)) sources.push(frame.url);
  }
  if (stack) incomplete = true;
  const urls = sources.map(parse);
  if (!urls.length || urls.some(x => !x || !["https:", "http:"].includes(x.protocol))) incomplete = true;
  const approved = urls.some(x => x && x.origin === pin.url && !x.username && !x.password && !x.port && !x.search && !x.hash && (x.pathname === "/login" || x.pathname.startsWith("/_next/static/")));
  const foreign = urls.some(x => x && x.origin !== pin.url);
  return { INITIATOR_TYPE: type, INITIATOR_APPROVED_SOURCE: incomplete ? UNKNOWN : approved, INITIATOR_FOREIGN_SOURCE: incomplete ? UNKNOWN : foreign };
}

async function bounded(readMetadata, ms = 250) {
  let timer;
  try { return await Promise.race([Promise.resolve().then(readMetadata).catch(() => UNKNOWN), new Promise(resolve => { timer = setTimeout(() => resolve(UNKNOWN), ms); })]); }
  finally { clearTimeout(timer); }
}

export function createFeedbackMetadataObserver(page, pin, productionRelationship, phase) {
  let sealed = false; let armed = false; let mainFrameId; let count = 0; let overflow = false;
  let authenticationCount = 0;
  let first = null; let capturing = false;
  const requests = new WeakMap(); const network = []; const pending = new Set(); const waiters = new Set();
  const notify = () => { for (const resolve of waiters) resolve(); waiters.clear(); };
  const observe = request => {
    if (sealed || read(() => request.url()) !== FEEDBACK_RESOURCE || requests.has(request)) return;
    count++; if (count > 1000000) overflow = true;
    // Preserve the first request-event snapshot, never the phase at capture time.
    // Global counting/correlation is intentionally NOT reset at submission.
    const originalPhase = read(() => phase(request));
    if (authenticationFeedbackPhase(originalPhase)) authenticationCount++;
    const frame = read(() => request.frame(), null);
    requests.set(request, Object.freeze({
      ordinal: count, authenticationOrdinal: authenticationFeedbackPhase(originalPhase) ? authenticationCount : 0,
      phase: originalPhase, method: read(() => request.method()), resourceType: read(() => request.resourceType()),
      navigation: read(() => request.isNavigationRequest()), redirect: read(() => request.redirectedFrom() !== null),
      serviceWorker: read(() => request.serviceWorker() !== null),
      initiatingLogin: frame ? read(() => frame.url() === `${pin.url}/login`) : UNKNOWN,
      mainFrame: frame ? read(() => frame === page.mainFrame() && frame.page() === page) : UNKNOWN,
      currentLogin: read(() => page.url() === `${pin.url}/login`),
    }));
  };
  const frameNavigated = event => { try { if (!sealed && !event.frame.parentId) mainFrameId = event.frame.id; } catch { mainFrameId = undefined; } };
  const requestWillBeSent = event => {
    if (sealed || read(() => event.request.url) !== FEEDBACK_RESOURCE) return;
    try {
    if (network.length >= 16) { overflow = true; notify(); return; }
    // Retain only structural classifications and private correlation identifiers.
    // Never retain the event, request headers, postData, URLs, or stack frames.
    network.push(Object.freeze({
      requestId: typeof event.requestId === "string" ? event.requestId : null,
      mainFrame: !!mainFrameId && event.frameId === mainFrameId,
      documentLogin: event.documentURL === `${pin.url}/login`,
      method: event.request.method === "GET" ? "GET" : "OTHER",
      script: event.type === "Script", redirect: !!event.redirectResponse,
      ...initiatorMetadata(event, pin),
    }));
    notify();
    } catch { overflow = true; notify(); }
  };
  const build = async request => {
    const snapshot = requests.get(request);
    const body = read(() => { const value = request.postDataBuffer(); return value === null ? false : value === undefined ? UNKNOWN : true; });
    const headersTask = bounded(async () => feedbackHeaderMetadata(await request.headersArray(), pin, body));
    let waiter;
    if (network.length === 0) await bounded(() => new Promise(resolve => { waiter = resolve; waiters.add(resolve); }));
    if (waiter) waiters.delete(waiter);
    const headers = await headersTask;
    const correlated = armed && !overflow && count === 1 && network.length === 1 && snapshot?.ordinal === 1 && network[0].requestId !== null && network[0].method === snapshot.method && network[0].script === (snapshot.resourceType === "script") && network[0].redirect === snapshot.redirect && network[0].mainFrame && network[0].documentLogin && snapshot.mainFrame === true && snapshot.initiatingLogin === true;
    const origin = correlated ? network[0] : {};
    const completeCount = armed && !overflow && count === network.length;
    return sanitizeFeedbackMetadata({
      ...feedbackTrafficMetadata(pin, { url: FEEDBACK_RESOURCE, ...snapshot, serverAction: headers?.SERVER_ACTION, credentialPresent: headers?.CREDENTIAL_METADATA_PRESENT, bodyPresent: body }),
      ...(typeof headers === "object" ? headers : {}), BODY_PRESENT: body,
      SERVICE_WORKER: snapshot?.serviceWorker, APPROVED_INITIATING_LOGIN: snapshot?.initiatingLogin,
      APPROVED_MAIN_FRAME: snapshot?.mainFrame, CURRENT_PAGE_LOGIN: snapshot?.currentLogin,
      EXACT_OCCURRENCE: snapshot?.ordinal,
      AUTHENTICATION_OCCURRENCE: snapshot?.authenticationOrdinal, ORIGINAL_LIFECYCLE_PHASE: snapshot?.phase,
      COUNT_COMPLETE: completeCount, SINGLE_OCCURRENCE: completeCount ? count === 1 : UNKNOWN,
      PRODUCTION_TARGET: productionRelationship, PRODUCTION_EXCLUSION_VERIFIED: typeof productionRelationship === "boolean" ? !productionRelationship : UNKNOWN,
      INITIATOR_CORRELATED: correlated, INITIATOR_TYPE: origin.INITIATOR_TYPE,
      INITIATOR_APPROVED_SOURCE: origin.INITIATOR_APPROVED_SOURCE, INITIATOR_FOREIGN_SOURCE: origin.INITIATOR_FOREIGN_SOURCE,
      INITIATOR_ATTRIBUTION_VERIFIED: correlated && ["SCRIPT", "PARSER"].includes(origin.INITIATOR_TYPE) && origin.INITIATOR_APPROVED_SOURCE === true && origin.INITIATOR_FOREIGN_SOURCE === false,
    });
  };
  return Object.freeze({
    observe, frameNavigated, requestWillBeSent,
    arm() { if (!sealed) armed = true; },
    get first() { return first; },
    capture(request, publish = () => {}) {
      if (sealed || capturing || read(() => request.url()) !== FEEDBACK_RESOURCE || read(() => request.method()) !== "GET" || read(() => request.resourceType()) !== "script" || !authenticationFeedbackPhase(requests.get(request)?.phase)) return Promise.resolve(null);
      capturing = true; // Reserve before asynchronous metadata reads; never reset.
      const task = build(request).catch(() => sanitizeFeedbackMetadata()).then(record => {
        if (!sealed) { first = record; publish(record); }
        return first;
      });
      pending.add(task);
      void task.then(() => pending.delete(task), () => pending.delete(task));
      return task;
    },
    async settle() { await Promise.allSettled([...pending]); },
    seal() { sealed = true; network.length = 0; notify(); },
  });
}

export async function attachFeedbackMetadata(page, pin, productionRelationship, phase) {
  const observer = createFeedbackMetadataObserver(page, pin, productionRelationship, phase);
  try {
    page.context().on("request", observer.observe);
    const cdp = await bounded(() => page.context().newCDPSession(page));
    if (cdp === UNKNOWN) return observer;
    cdp.on("Page.frameNavigated", observer.frameNavigated);
    cdp.on("Network.requestWillBeSent", observer.requestWillBeSent);
    const enabled = await bounded(async () => { await cdp.send("Page.enable"); await cdp.send("Network.enable"); return true; });
    if (enabled === true) observer.arm();
  } catch { /* Missing protocol evidence stays unknown; the request remains fatal. */ }
  return observer;
}
