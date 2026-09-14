// Empty-field diagnostic only. No credential access or validation bypass.
import { PIN, assertProof, assertRequest, assertOidcClaims } from "../phase6/hosted-auth-smoke.mjs";

// Serialized into the already-intercepted /login page. Read booleans only;
// never copy/return field values or write values/validation attributes.
export function submitEmptyLoginForm({ origin }) {
  if (window !== top || location.href !== `${origin}/login`) throw Error("EMPTY_SUBMIT_PAGE_MISMATCH");
  const emails = document.querySelectorAll('input#email[type="email"]');
  const passwords = document.querySelectorAll('input#password[type="password"]');
  if (emails.length !== 1 || passwords.length !== 1) throw Error("EMPTY_SUBMIT_FIELDS_NOT_UNIQUE");
  const email = emails[0]; const password = passwords[0]; const form = email.form;
  if (!form || password.form !== form || !(form instanceof HTMLFormElement)) throw Error("EMPTY_SUBMIT_FORM_MISMATCH");
  const propsKey = Object.keys(form).find((key) => key.startsWith("__reactProps$"));
  if (!propsKey || typeof form[propsKey]?.action !== "function") throw Error("EMPTY_SUBMIT_HYDRATION_UNVERIFIED");
  if (form.noValidate !== false || !email.required || !password.required || !email.willValidate || !password.willValidate) throw Error("EMPTY_SUBMIT_VALIDATION_CONFIG_UNEXPECTED");
  if (email.value !== "" || password.value !== "") throw Error("EMPTY_SUBMIT_NONEMPTY_FIELDS");
  const result = { emailEmpty: true, passwordEmpty: true, emailValueMissing: email.validity.valueMissing, passwordValueMissing: password.validity.valueMissing,
    validationEnabled: !form.noValidate, emailInvalidEvent: false, passwordInvalidEvent: false, submitEvent: false, invoked: false };
  const emailInvalid = () => { result.emailInvalidEvent = true; };
  const passwordInvalid = () => { result.passwordInvalidEvent = true; };
  const submitted = () => { result.submitEvent = true; };
  email.addEventListener("invalid", emailInvalid);
  password.addEventListener("invalid", passwordInvalid);
  form.addEventListener("submit", submitted);
  try {
    form.requestSubmit(); // Exactly one call; native required-field validation stays enabled.
    result.invoked = true;
  } finally {
    email.removeEventListener("invalid", emailInvalid);
    password.removeEventListener("invalid", passwordInvalid);
    form.removeEventListener("submit", submitted);
  }
  return result;
}

export async function runEmptyFieldSubmit(page, state, proof, claims) {
  assertProof(proof); assertOidcClaims(claims);
  const ready = state.interceptionArmed === true && state.stopped === false && state.firstRefusal === null &&
    state.emptyFieldSubmitCount === 0 && state.loginResponseObserved === true && state.forgotNonfatalBlockCount === 1 &&
    state.forgotIrrelevantRefusal?.forgotPasswordAbortConfirmed === true &&
    state.forgotIrrelevantRefusal?.forgotPasswordMetadata?.purposeClassification === "AUTOMATIC_FRAMEWORK_PREFETCH" &&
    state.forgotIrrelevantRefusal?.forgotPasswordMetadata?.observation?.loginHydrated === true;
  if (!ready) throw Error("EMPTY_SUBMIT_INTERCEPTION_OR_PREFLIGHT_UNVERIFIED");
  assertRequest(proof, page.url(), "GET");
  if (page.url() !== `${PIN.url}/login`) throw Error("EMPTY_SUBMIT_PAGE_MISMATCH");
  state.emptyFieldSubmitCount = 1; // Reserve before invoking any browser operation; never retry.
  state.emptyFormConstruction = true;
  return page.evaluate(submitEmptyLoginForm, { origin: PIN.url });
}

export function nativeValidationPreventedRequest(result, state) {
  return state.firstRefusal === null && result?.invoked === true && result.emailEmpty === true && result.passwordEmpty === true &&
    result.emailValueMissing === true && result.passwordValueMissing === true && result.validationEnabled === true &&
    result.emailInvalidEvent === true && result.passwordInvalidEvent === true && result.submitEvent === false;
}

// Presence-only metadata for the abort path. Never inspect body bytes/values.
export function emptySubmissionRequestMetadata(request, facts) {
  let body = null; let crossOriginRedirect = null;
  try { body = request.postDataBuffer() !== null; } catch { /* unknown */ }
  try {
    let prior = request.redirectedFrom(); crossOriginRedirect = false;
    for (let depth = 0; prior !== null; depth++) {
      if (depth >= 16) { crossOriginRedirect = null; break; }
      if (new URL(prior.url()).origin !== PIN.url) { crossOriginRedirect = true; break; }
      prior = prior.redirectedFrom();
    }
  } catch { crossOriginRedirect = null; }
  let supabaseAuth = null; let applicationAuthApi = null;
  try {
    const url = new URL(request.url());
    supabaseAuth = url.hostname === "nftufhffzlokryafcbku.supabase.co" && url.pathname.startsWith("/auth/");
    applicationAuthApi = url.origin === PIN.url && /^\/api\/auth(?:\/|$)/.test(url.pathname);
  } catch { /* unknown */ }
  return { requestBodyPresent: body, credentialBearingHeaderPresent: facts.headersKnown === true ? facts.credentialBearing === true : null,
    formSubmission: facts.submitInvoked === true && (facts.serverAction === true || (facts.navigation === true && request.method() === "POST")),
    fetchOrXhr: ["fetch", "xhr"].includes(request.resourceType()), serverAction: facts.serverAction === true,
    supabaseAuth, applicationAuthApi, redirectAssociated: typeof facts.redirected === "boolean" ? facts.redirected : null, crossOriginRedirect };
}
