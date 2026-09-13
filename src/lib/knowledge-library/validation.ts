/** Multiline fields allow tabs and line endings, but not other control characters. */
export function libraryText(form: FormData, name: string, max = 10000, required = false, multiline = false) {
  const value = String(form.get(name) ?? "").trim();
  const controls = multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/ : /[\u0000-\u001f]/;
  if ((required && !value) || value.length > max || controls.test(value)) throw new Error(`Invalid ${name}.`);
  return value;
}
