// Read-only metadata inventory. No field contents, DOM mutation or input APIs.
import { PIN, assertProof, assertOidcClaims, assertRequest } from "../phase6/hosted-auth-smoke.mjs";

export function loginElementInventory({ origin }) {
  if (window !== top || location.href !== `${origin}/login`) throw Error("ELEMENT_INVENTORY_PAGE_MISMATCH");
  const emails = document.querySelectorAll('input#email[type="email"]');
  const passwords = document.querySelectorAll('input#password[type="password"]');
  if (emails.length !== 1 || passwords.length !== 1) throw Error("ELEMENT_INVENTORY_FIELDS_NOT_UNIQUE");
  const email = emails[0]; const password = passwords[0]; const form = email.form;
  if (!(form instanceof HTMLFormElement) || password.form !== form) throw Error("ELEMENT_INVENTORY_FORM_MISMATCH");
  const controls = Array.from(form.elements);
  const challengeMatches = Array.from(document.querySelectorAll('iframe,[data-sitekey],.g-recaptcha,.h-captcha,.cf-turnstile'));
  // Exactly the existing predicate, evaluated read-only. This is NOT permission.
  const unexpectedControls = controls.filter(field => field !== email && field !== password &&
    !(field instanceof HTMLInputElement && field.type === "hidden" && field.name === "next" && !field.required) &&
    !(field instanceof HTMLButtonElement && field.type === "submit" && !field.disabled && !field.formNoValidate));
  const extras = Array.from(document.querySelectorAll('a,button,input,select,textarea,[role="button"],[role="checkbox"],iframe,[data-sitekey],.g-recaptcha,.h-captcha,.cf-turnstile'));
  const elements = [...new Set([...controls, ...extras])];
  if (elements.length > 64) throw Error("ELEMENT_INVENTORY_LIMIT");
  const knownNames = new Set(["email", "password", "next", "$ACTION_KEY", "remember", "remember-me", "csrf", "csrf_token", "_csrf", "g-recaptcha-response", "h-captcha-response", "cf-turnstile-response"]);
  const knownLabels = new Set(["Email address", "Password", "Sign in", "Please wait…", "Forgot your password?", "Show password", "Hide password", "Remember me", "Continue with Google", "Sign in with Google", "Fulfillment Management Platform"]);
  const safeName = raw => {
    if (!raw) return "NONE";
    if (knownNames.has(raw)) return raw;
    if (raw.startsWith("$ACTION_ID_")) return "$ACTION_ID_[REDACTED]";
    if (raw.startsWith("$ACTION_REF_")) return "$ACTION_REF_[REDACTED]";
    if (/^\$ACTION_\d+:\d+$/.test(raw)) return "$ACTION_[INDEX]:[INDEX]";
    return "[REDACTED_UNRECOGNIZED_IDENTIFIER]";
  };
  const safeLabel = raw => knownLabels.has(raw?.trim()) ? raw.trim() : raw?.trim() ? "[REDACTED_UNRECOGNIZED_LABEL]" : "NONE";
  const describe = (field, index) => {
    const tag = field.localName;
    const input = field instanceof HTMLInputElement;
    const button = field instanceof HTMLButtonElement;
    const link = field instanceof HTMLAnchorElement;
    const type = input || button ? field.type : "NONE";
    const rawName = field.getAttribute("name");
    const rawId = field.getAttribute("id");
    const labels = "labels" in field && field.labels ? Array.from(field.labels).map(label => safeLabel(label.textContent)) : [];
    const explicitRole = field.getAttribute("role");
    const role = explicitRole ? ["button", "textbox", "checkbox", "link", "presentation", "none", "combobox"].includes(explicitRole) ? explicitRole : "OTHER_EXPLICIT_ROLE" :
      link ? "link" : button ? "button" : input && type !== "hidden" ? type === "checkbox" ? "checkbox" : type === "password" ? "password_input" : "textbox" : "NONE";
    const required = typeof field.required === "boolean" ? field.required : false;
    const disabled = typeof field.disabled === "boolean" ? field.disabled : false;
    const readonly = typeof field.readOnly === "boolean" ? field.readOnly : false;
    const validationCandidate = typeof field.willValidate === "boolean" ? field.willValidate : false;
    const frameworkActionName = typeof rawName === "string" && rawName.startsWith("$ACTION_");
    const matchedChallengeSelectors = [];
    for (const selector of ['iframe', '[data-sitekey]', '.g-recaptcha', '.h-captcha', '.cf-turnstile']) if (field.matches(selector)) matchedChallengeSelectors.push(selector);
    return { index: index + 1, tag, type, role, name: safeName(rawName), id: safeName(rawId),
      labels, label: safeLabel(field.getAttribute("aria-label") || (link || button ? field.textContent : "")),
      formAssociation: field.form === form ? "LOGIN_FORM" : field.form ? "OTHER_FORM" : "NONE",
      required, disabled, readonly, validationCandidate,
      minLengthAttributePresent: field.hasAttribute("minlength"), patternAttributePresent: field.hasAttribute("pattern"),
      validationRole: !validationCandidate ? "NOT_VALIDATED" : field === email ? "REQUIRED_EMAIL_FORMAT" : field === password ? "REQUIRED_PASSWORD" : required ? "ADDITIONAL_REQUIRED_CONTROL" : "OPTIONAL_CONTROL",
      frameworkActionName, actionValueNotRead: true,
      formNoValidate: typeof field.formNoValidate === "boolean" ? field.formNoValidate : false,
      forgotPasswordLink: link && field.getAttribute("href") === "/forgot-password",
      triggeringUnexpectedFormControl: unexpectedControls.includes(field), triggeringDocumentSelector: challengeMatches.includes(field), matchedChallengeSelectors };
  };
  const propsKey = Object.keys(form).find(key => key.startsWith("__reactProps$"));
  return { guardName: "SYNTHETIC_ADDITIONAL_CONTROL_REQUIREMENT", guardTriggered: challengeMatches.length > 0 || unexpectedControls.length > 0,
    documentSelectorMatchCount: challengeMatches.length, unexpectedFormControlCount: unexpectedControls.length, formControlCount: controls.length,
    formNoValidate: form.noValidate, reactActionIsFunction: !!propsKey && typeof form[propsKey]?.action === "function",
    fieldValuesRead: false, isActive: navigator.userActivation?.isActive === true, hasBeenActive: navigator.userActivation?.hasBeenActive === true,
    elements: elements.map(describe) };
}

export async function inspectLoginElements(page, state, proof, claims) {
  const check = () => {
    assertProof(proof); assertOidcClaims(claims); assertRequest(proof, page.url(), "GET");
    if (page.url() !== `${PIN.url}/login` || state.interceptionArmed !== true || state.stopped !== false || state.firstRefusal !== null ||
      state.loginResponseObserved !== true || state.syntheticSubmitCount !== 0 || state.emptyFieldSubmitCount !== 0 ||
      state.elementInventoryCount !== 0 || state.forgotNonfatalBlockCount !== 1 ||
      state.forgotIrrelevantRefusal?.forgotPasswordAbortConfirmed !== true ||
      state.forgotIrrelevantRefusal?.forgotPasswordMetadata?.purposeClassification !== "AUTOMATIC_FRAMEWORK_PREFETCH") throw Error("ELEMENT_INVENTORY_PREFLIGHT_UNVERIFIED");
  };
  check();
  const cdp = await page.context().newCDPSession(page);
  try {
    check(); state.elementInventoryCount = 1;
    // CDP read-only snapshot; never use Playwright evaluation's userGesture:true.
    const result = await cdp.send("Runtime.evaluate", { expression: `(${loginElementInventory.toString()})(${JSON.stringify({ origin: PIN.url })})`,
      returnByValue: true, userGesture: false, awaitPromise: false, includeCommandLineAPI: false, silent: true, timeout: 5000 });
    if (result.exceptionDetails || !result.result?.value || result.result.value.fieldValuesRead !== false) throw Error("ELEMENT_INVENTORY_READ_FAILED");
    if (state.stopped || state.firstRefusal !== null) throw Error("ELEMENT_INVENTORY_INTERRUPTED");
    return result.result.value;
  } finally { await cdp.detach(); }
}
