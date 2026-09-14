// One synthetic, non-account request-construction exercise. Never authentication.
import { PIN, assertProof, assertRequest, assertOidcClaims } from "../phase6/hosted-auth-smoke.mjs";

export function syntheticFailureCode(error) {
  const codes = ["SYNTHETIC_PREFLIGHT_UNVERIFIED", "SYNTHETIC_PAGE_MISMATCH", "SYNTHETIC_FIELDS_NOT_UNIQUE", "SYNTHETIC_FORM_MISMATCH",
    "SYNTHETIC_HYDRATION_UNVERIFIED", "SYNTHETIC_VALIDATION_CONFIG_UNEXPECTED", "SYNTHETIC_ADDITIONAL_FORMAT_REQUIREMENT",
    "SYNTHETIC_ADDITIONAL_CONTROL_REQUIREMENT", "SYNTHETIC_NONEMPTY_FIELDS", "SYNTHETIC_CAPTURE_NOT_READY",
    "SYNTHETIC_METADATA_STOPPED", "SYNTHETIC_METADATA_INVALID", "SYNTHETIC_PREFLIGHT_TIMEOUT", "SYNTHETIC_NONBOOLEAN_METADATA", "SYNTHETIC_VISIBLE_FIELDS_UNVERIFIED"];
  return codes.find(code => typeof error?.message === "string" && error.message.includes(code)) ?? null;
}

export function assertSyntheticPreflight(page, state, proof, claims) {
  assertProof(proof); assertOidcClaims(claims);
  const ready = state.interceptionArmed === true && state.stopped === false && state.firstRefusal === null &&
    state.syntheticSubmitCount === 0 && state.loginResponseObserved === true && state.forgotNonfatalBlockCount === 1 &&
    state.forgotIrrelevantRefusal?.forgotPasswordAbortConfirmed === true &&
    state.forgotIrrelevantRefusal?.forgotPasswordMetadata?.purposeClassification === "AUTOMATIC_FRAMEWORK_PREFETCH" &&
    state.forgotIrrelevantRefusal?.forgotPasswordMetadata?.observation?.loginHydrated === true;
  if (!ready) throw Error("SYNTHETIC_PREFLIGHT_UNVERIFIED");
  assertRequest(proof, page.url(), "GET");
  if (page.url() !== `${PIN.url}/login`) throw Error("SYNTHETIC_PAGE_MISMATCH");
}

// Runs only AFTER interception and exact framework-prefetch verification. The
// one-way result contains booleans only, never generated values or form contents.
export function submitSyntheticLoginForm({ origin }) {
  const refused = code => { throw Error(code); };
  if (window !== top || location.href !== `${origin}/login`) refused("SYNTHETIC_PAGE_MISMATCH");
  const emails = document.querySelectorAll('input#email[type="email"]');
  const passwords = document.querySelectorAll('input#password[type="password"]');
  if (emails.length !== 1 || passwords.length !== 1) refused("SYNTHETIC_FIELDS_NOT_UNIQUE");
  const email = emails[0]; const password = passwords[0]; const form = email.form;
  if (!(form instanceof HTMLFormElement) || password.form !== form) refused("SYNTHETIC_FORM_MISMATCH");
  const propsKey = Object.keys(form).find(key => key.startsWith("__reactProps$"));
  if (!propsKey || typeof form[propsKey]?.action !== "function") refused("SYNTHETIC_HYDRATION_UNVERIFIED");
  if (form.noValidate !== false || !email.required || !password.required || !email.willValidate || !password.willValidate ||
    email.disabled || password.disabled || email.readOnly || password.readOnly ||
    email.name !== "email" || password.name !== "password") refused("SYNTHETIC_VALIDATION_CONFIG_UNEXPECTED");
  // Fail closed on any requirement not present in the reviewed immutable source.
  if ([email, password].some(field => ["minlength", "maxlength", "pattern", "multiple"].some(name => field.hasAttribute(name)))) refused("SYNTHETIC_ADDITIONAL_FORMAT_REQUIREMENT");
  // STRUCTURAL RECOGNITION ONLY: the observed four-member React bound-action
  // group remains framework-managed. Never read attributes/properties containing
  // values; never mutate, serialize or manually submit these hidden controls.
  const actionControls = Array.from(form.elements).filter(field => field instanceof HTMLInputElement && field.name.startsWith("$ACTION_"));
  const referenceControls = actionControls.filter(field => /^\$ACTION_REF_(0|[1-9]\d{0,11})$/.test(field.name));
  const frameworkHiddenControls = new Set();
  if (actionControls.length === 4 && referenceControls.length === 1) {
    const prefix = referenceControls[0].name.slice("$ACTION_REF_".length);
    const names = actionControls.map(field => field.name);
    const indexedNames = names.filter(name => name.startsWith(`$ACTION_${prefix}:`) && /^\$ACTION_\d+:(0|[1-9]\d{0,11})$/.test(name));
    const groupMatches = new Set(names).size === 4 && names.includes("$ACTION_KEY") && indexedNames.length === 2 &&
      indexedNames.includes(`$ACTION_${prefix}:0`) &&
      actionControls.every(field => field.form === form && form.contains(field) && field.type === "hidden" &&
        !field.required && !field.disabled && !field.readOnly && !field.willValidate && !field.id && !field.hasAttribute("role"));
    if (groupMatches) for (const field of actionControls) frameworkHiddenControls.add(field);
  }
  if (document.querySelector('iframe,[data-sitekey],.g-recaptcha,.h-captcha,.cf-turnstile') ||
    Array.from(form.elements).some(field => field !== email && field !== password &&
      !(field instanceof HTMLInputElement && field.type === "hidden" && field.name === "next" && !field.required) &&
      !(field instanceof HTMLButtonElement && field.type === "submit" && !field.disabled && !field.formNoValidate) &&
      !frameworkHiddenControls.has(field))) refused("SYNTHETIC_ADDITIONAL_CONTROL_REQUIREMENT");
  const visibleLoginFields = [email, password].every(field => {
    const rect = field.getBoundingClientRect(); const style = getComputedStyle(field);
    return form.contains(field) && !field.hidden && !field.closest('[hidden],[inert],[aria-hidden="true"]') &&
      rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility === "visible" && Number(style.opacity) > 0;
  });
  if (!visibleLoginFields) refused("SYNTHETIC_VISIBLE_FIELDS_UNVERIFIED");
  if (email.value !== "" || password.value !== "") refused("SYNTHETIC_NONEMPTY_FIELDS");
  if (typeof window.__p7SyntheticUrlForm !== "function" || typeof crypto.randomUUID !== "function") refused("SYNTHETIC_CAPTURE_NOT_READY");

  // Metadata handshake finishes before native fetch is invoked. No fetch body,
  // header, field value or request-init contents are inspected by this wrapper.
  const originalFetch = window.fetch;
  window.fetch = async function(input, ...rest) {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input instanceof Request ? input.url : null;
    if (raw !== null) {
      const resolved = new URL(raw, document.baseURI);
      await window.__p7SyntheticUrlForm({ url: `${resolved.origin}${resolved.pathname}`, base: `${location.origin}${location.pathname}`,
        form: input instanceof Request ? "UNKNOWN" : /^[a-z][a-z0-9+.-]*:/i.test(raw) ? "ABSOLUTE" : "RELATIVE" });
    }
    return originalFetch.call(this, input, ...rest);
  };
  // Reserved invalid domain + fresh local UUID: not an account/credential source.
  email.value = `phase7-capture-${crypto.randomUUID()}@example.invalid`;
  password.value = `capture-only-${crypto.randomUUID()}`;
  const result = { syntheticValuesOnly: true, emailFormatValid: email.validity.valid, passwordFormatValid: password.validity.valid,
    validationEnabled: !form.noValidate, formFormatValid: Array.from(form.elements).every(field => !field.willValidate || field.validity.valid),
    submitEvent: false, invoked: false, frameworkHiddenControlsRecognized: frameworkHiddenControls.size === 4, visibleLoginFieldsVerified: visibleLoginFields };
  if (!result.emailFormatValid || !result.passwordFormatValid || !result.formFormatValid) return result;
  const submitted = () => { result.submitEvent = true; };
  form.addEventListener("submit", submitted);
  try { form.requestSubmit(); result.invoked = true; } // Exactly once; validation stays enabled.
  finally { form.removeEventListener("submit", submitted); }
  return result;
}

export async function runSyntheticSubmit(page, state, proof, claims, urlForms, sanitizeUrl) {
  assertSyntheticPreflight(page, state, proof, claims);
  await page.exposeBinding("__p7SyntheticUrlForm", (source, metadata) => {
    if (state.stopped || source.page !== page || source.frame !== page.mainFrame()) throw Error("SYNTHETIC_METADATA_STOPPED");
    if (!metadata || typeof metadata.url !== "string" || typeof metadata.base !== "string" ||
      !["RELATIVE", "ABSOLUTE", "UNKNOWN"].includes(metadata.form) || urlForms.size >= 32) throw Error("SYNTHETIC_METADATA_INVALID");
    urlForms.set(sanitizeUrl(metadata.url).url, { form: metadata.form, base: sanitizeUrl(metadata.base).url });
  });
  assertSyntheticPreflight(page, state, proof, claims); // Recheck after asynchronous registration, before any field input.
  state.syntheticSubmitCount = 1; // Reserve invocation; failures must never retry.
  state.hydrationCompleted = true;
  return page.evaluate(submitSyntheticLoginForm, { origin: PIN.url });
}
