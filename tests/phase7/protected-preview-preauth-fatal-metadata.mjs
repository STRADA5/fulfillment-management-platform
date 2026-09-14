// Separate PRE_AUTHENTICATION evidence observer. It has no routing, input,
// credential, lifecycle-transition, or authentication-collector capability.
import { FEEDBACK_RESOURCE, feedbackHeaderMetadata, feedbackTrafficMetadata, sanitizeFeedbackMetadata } from "./protected-preview-feedback-metadata.mjs";

const PRE = "PRE_AUTHENTICATION";
const UNKNOWN = "UNKNOWN";
const read = (fn, fallback = UNKNOWN) => { try { return fn(); } catch { return fallback; } };
const tri = value => typeof value === "boolean" ? value : UNKNOWN;
const parse = value => read(() => new URL(value), null);
const GUARDS = new Set(["ASSERT_REQUEST_EXACT_TARGET_COMPOUND", "OTHER_GUARD_STAGE"]);
const PREDICATES = new Set(["ORIGIN_EQUALS_PIN", "PROTOCOL_HTTPS", "HOSTNAME_EQUALS_PIN", "USERNAME_ABSENT", "PASSWORD_ABSENT", "NONDEFAULT_PORT_ABSENT", "FRAGMENT_ABSENT", "OTHER_GUARD_STAGE"]);

export function sanitizePreauthenticationMetadata(raw = {}) {
  // Share only pure redaction/classification helpers, NEVER the auth collector.
  const record = { ...sanitizeFeedbackMetadata(raw) };
  delete record.AUTHENTICATION_OCCURRENCE;
  // Metadata inspection is not a refusal: the caller separately decides whether
  // to record a fatal supplement or the reviewed blocked/nonfatal receipt.
  delete record.FIRST_FATAL_REFUSAL;
  delete record.NETWORK_DECISION;
  delete record.CAPTURE_CONTROL;
  record.AUTHENTICATION_PHASE = false;
  record.ORIGINAL_LIFECYCLE_PHASE = read(() => raw.ORIGINAL_LIFECYCLE_PHASE) === PRE ? PRE : UNKNOWN;
  for (const key of ["BEFORE_TRANSMISSION", "SCRIPT", "RSC_QUERY_PRESENT"]) record[key] = tri(read(() => raw[key]));
  const guard = read(() => raw.GUARD_RULE); const predicate = read(() => raw.FIRST_FAILED_PREDICATE);
  record.GUARD_RULE = GUARDS.has(guard) ? guard : UNKNOWN;
  record.FIRST_FAILED_PREDICATE = PREDICATES.has(predicate) ? predicate : UNKNOWN;
  return Object.freeze(record);
}

export function sanitizePreauthenticationFatalMetadata(raw = {}) {
  return Object.freeze({ ...sanitizePreauthenticationMetadata(raw),
    FIRST_FATAL_REFUSAL: true, NETWORK_DECISION: "BLOCKED", CAPTURE_CONTROL: "FATAL" });
}

export function preauthenticationFatalMetadataLines(raw) {
  return Object.entries(sanitizePreauthenticationFatalMetadata(raw)).map(([key, value]) =>
    `P7_PREAUTH_FATAL_${key}=${typeof value === "boolean" ? value ? "YES" : "NO" : value}`);
}

async function bounded(operation) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(operation).catch(() => UNKNOWN),
      new Promise(resolve => { timer = setTimeout(() => resolve(UNKNOWN), 250); }),
    ]);
  } finally { clearTimeout(timer); }
}

function initiatorFacts(event, pin) {
  const types = { parser: "PARSER", script: "SCRIPT", preload: "PRELOAD", preflight: "PREFLIGHT", signedExchange: "SIGNED_EXCHANGE", other: "OTHER" };
  const type = read(() => types[event.initiator.type], UNKNOWN);
  const sources = [];
  if (typeof event.initiator?.url === "string") sources.push(event.initiator.url);
  let stack = event.initiator?.stack; let incomplete = false;
  for (let depth = 0; stack && depth < 8; depth++, stack = stack.parent) {
    if (!Array.isArray(stack.callFrames)) { incomplete = true; break; }
    if (stack.callFrames.length > 64 || stack.parentId) incomplete = true;
    for (const frame of stack.callFrames.slice(0, 64)) sources.push(frame.url);
  }
  if (stack) incomplete = true;
  const urls = sources.map(parse);
  if (!urls.length || urls.some(url => !url || !["https:", "http:"].includes(url.protocol))) incomplete = true;
  const approved = urls.some(url => url && url.origin === pin.url && !url.username && !url.password && !url.port && !url.search && !url.hash && (url.pathname === "/login" || url.pathname.startsWith("/_next/static/")));
  const foreign = urls.some(url => url && url.origin !== pin.url);
  return { INITIATOR_TYPE: type, INITIATOR_APPROVED_SOURCE: incomplete ? UNKNOWN : approved, INITIATOR_FOREIGN_SOURCE: incomplete ? UNKNOWN : foreign };
}

export function createPreauthenticationFatalMetadataObserver(page, pin, productionRelationship, requestPhase, currentPhase) {
  let frozen = false; let armed = false; let mainFrameId;
  let first = null; let reserved = false; let count = 0; let overflow = false;
  const requests = new WeakMap(); const network = []; const pending = new Set(); const waiters = new Set();
  const active = () => !frozen && read(currentPhase) === PRE;
  const notify = () => { for (const resolve of waiters) resolve(); waiters.clear(); };
  const observe = request => {
    if (!active() || requests.has(request) || read(() => requestPhase(request)) !== PRE) return;
    const exact = read(() => request.url()) === FEEDBACK_RESOURCE;
    if (exact && ++count > 1000000) overflow = true;
    const frame = read(() => request.frame(), null);
    // No raw URLs, headers, bodies, requests or identifiers in the snapshot.
    requests.set(request, Object.freeze({
      phase: PRE, exact, ordinal: exact ? count : UNKNOWN,
      resourceType: read(() => request.resourceType()), method: read(() => request.method()),
      navigation: read(() => request.isNavigationRequest()), redirect: read(() => request.redirectedFrom() !== null),
      serviceWorker: read(() => request.serviceWorker() !== null),
      mainFrame: frame ? read(() => frame === page.mainFrame() && frame.page() === page) : UNKNOWN,
      initiatingLogin: frame ? read(() => frame.url() === `${pin.url}/login`) : UNKNOWN,
      currentLogin: read(() => page.url() === `${pin.url}/login`),
      // Classification reads the URL privately; it does not retain the URL.
      traffic: feedbackTrafficMetadata(pin, { url: read(() => request.url()), phase: PRE,
        method: read(() => request.method()), resourceType: read(() => request.resourceType()),
        navigation: read(() => request.isNavigationRequest()), redirect: read(() => request.redirectedFrom() !== null) }),
    }));
  };
  const frameNavigated = event => {
    if (!active()) return;
    try { if (!event.frame.parentId) mainFrameId = event.frame.id; } catch { mainFrameId = undefined; }
  };
  const requestWillBeSent = event => {
    if (!active() || read(() => event.request.url) !== FEEDBACK_RESOURCE) return;
    try {
      if (network.length >= 16) { overflow = true; notify(); return; }
      network.push(Object.freeze({
        // Private correlation IDs never enter the evidence serializer.
        requestId: typeof event.requestId === "string" ? event.requestId : null,
        mainFrame: !!mainFrameId && event.frameId === mainFrameId,
        documentLogin: event.documentURL === `${pin.url}/login`,
        method: event.request.method === "GET" ? "GET" : "OTHER",
        script: event.type === "Script", redirect: !!event.redirectResponse,
        ...initiatorFacts(event, pin),
      }));
      notify();
    } catch { overflow = true; notify(); }
  };
  const build = async (request, snapshot, base) => {
    let extra = {};
    // The five-fact supplement is for the exact observed feedback resource.
    // Other fatal traffic retains the existing safe base record + UNKNOWN facts.
    if (snapshot.exact && snapshot.method === "GET" && snapshot.resourceType === "script") {
      const body = read(() => { const value = request.postDataBuffer(); return value === null ? false : value === undefined ? UNKNOWN : true; });
      const headersTask = bounded(async () => active() ? feedbackHeaderMetadata(await request.headersArray(), pin, body) : UNKNOWN);
      let waiter;
      if (network.length === 0) await bounded(() => active() ? new Promise(resolve => { waiter = resolve; waiters.add(resolve); }) : UNKNOWN);
      if (waiter) waiters.delete(waiter);
      const headers = await headersTask;
      const correlated = armed && !overflow && count === 1 && network.length === 1 && snapshot.ordinal === 1 && network[0].requestId !== null && network[0].method === snapshot.method && network[0].script && network[0].redirect === snapshot.redirect && network[0].mainFrame && network[0].documentLogin && snapshot.mainFrame === true && snapshot.initiatingLogin === true;
      const origin = correlated ? network[0] : {};
      const complete = armed && !overflow && count === network.length;
      extra = {
        ...feedbackTrafficMetadata(pin, { url: FEEDBACK_RESOURCE, ...snapshot, serverAction: headers?.SERVER_ACTION, credentialPresent: headers?.CREDENTIAL_METADATA_PRESENT, bodyPresent: body }),
        ...(typeof headers === "object" ? headers : {}), BODY_PRESENT: body,
        EXACT_OCCURRENCE: snapshot.ordinal, COUNT_COMPLETE: complete,
        SINGLE_OCCURRENCE: complete ? count === 1 : UNKNOWN,
        PRODUCTION_TARGET: productionRelationship, PRODUCTION_EXCLUSION_VERIFIED: typeof productionRelationship === "boolean" ? !productionRelationship : UNKNOWN,
        INITIATOR_CORRELATED: correlated, ...origin,
        INITIATOR_ATTRIBUTION_VERIFIED: correlated && ["SCRIPT", "PARSER"].includes(origin.INITIATOR_TYPE) && origin.INITIATOR_APPROVED_SOURCE === true && origin.INITIATOR_FOREIGN_SOURCE === false,
      };
    }
    return sanitizePreauthenticationMetadata({
      ...snapshot.traffic, ...extra, ...base,
      ORIGINAL_LIFECYCLE_PHASE: snapshot.phase,
      SCRIPT: snapshot.resourceType === UNKNOWN ? UNKNOWN : snapshot.resourceType === "script",
      SERVICE_WORKER: snapshot.serviceWorker, APPROVED_MAIN_FRAME: snapshot.mainFrame,
      APPROVED_INITIATING_LOGIN: snapshot.initiatingLogin, CURRENT_PAGE_LOGIN: snapshot.currentLogin,
    });
  };
  return Object.freeze({
    observe, frameNavigated, requestWillBeSent,
    get active() { return active(); },
    get first() { return first; },
    arm() { if (active()) armed = true; },
    async inspect(request, details) {
      const snapshot = requests.get(request);
      if (!active() || snapshot?.phase !== PRE) return null;
      const record = await build(request, snapshot, details);
      // A phase change, duplicate, or lost correlation during the read cannot
      // reuse an earlier positive snapshot for a control-policy decision.
      if (!active() || count !== 1 || network.length !== 1 || overflow) return null;
      if (read(() => page.url() === `${pin.url}/login` && request.frame() === page.mainFrame() &&
        request.frame().page() === page && request.frame().url() === `${pin.url}/login`) !== true) return null;
      return record;
    },
    capture(request, refusal, publish = () => {}) {
      const snapshot = requests.get(request);
      // Called ONLY after the existing global journal has latched a fatal guard
      // refusal. Its URL/predicate details remain in P7_FIRST_REFUSAL_*, not a
      // second journal. This supplement never provides a routing result.
      if (!active() || reserved || snapshot?.phase !== PRE || !Object.isFrozen(refusal) || read(() => refusal.ORIGINAL_LIFECYCLE_PHASE) !== PRE || read(() => refusal.BEFORE_TRANSMISSION) !== true) return Promise.resolve(null);
      reserved = true; // Irrevocable first winner before any asynchronous read.
      const base = sanitizePreauthenticationFatalMetadata({
        ORIGINAL_LIFECYCLE_PHASE: PRE, BEFORE_TRANSMISSION: true,
        RSC_QUERY_PRESENT: read(() => refusal.RSC_QUERY_PRESENT),
        GUARD_RULE: read(() => refusal.GUARD_RULE), FIRST_FAILED_PREDICATE: read(() => refusal.FIRST_FAILED_PREDICATE),
      });
      // Only the base fields above are supplemental; UNKNOWN defaults must not
      // overwrite newly observed metadata when merging the completed record.
      const details = Object.fromEntries(["BEFORE_TRANSMISSION", "RSC_QUERY_PRESENT", "GUARD_RULE", "FIRST_FAILED_PREDICATE"].map(key => [key, base[key]]));
      const task = build(request, snapshot, details).catch(() => base).then(record => {
        // A winning in-flight capture survives cleanup/freeze, never relabels.
        first = sanitizePreauthenticationFatalMetadata(record);
        read(() => publish(first)); // Diagnostic sink failure cannot change refusal.
        return first;
      });
      pending.add(task);
      void task.then(() => pending.delete(task), () => pending.delete(task));
      return task;
    },
    freeze() { frozen = true; notify(); },
    async settle() { await Promise.allSettled([...pending]); },
  });
}

export async function attachPreauthenticationFatalMetadata(page, pin, productionRelationship, requestPhase, currentPhase) {
  const observer = createPreauthenticationFatalMetadataObserver(page, pin, productionRelationship, requestPhase, currentPhase);
  try {
    page.context().on("request", observer.observe);
    const cdp = await bounded(() => page.context().newCDPSession(page));
    if (cdp === UNKNOWN) return observer;
    cdp.on("Page.frameNavigated", observer.frameNavigated);
    cdp.on("Network.requestWillBeSent", observer.requestWillBeSent);
    const enabled = await bounded(async () => { await cdp.send("Page.enable"); await cdp.send("Network.enable"); return true; });
    if (enabled === true) observer.arm();
  } catch { /* Missing metadata stays UNKNOWN; no control/policy fallback. */ }
  return observer;
}
