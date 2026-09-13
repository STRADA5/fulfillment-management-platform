import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

// Execute the actual pure validator under Node 22 as well as newer Node versions.
const source = readFileSync(new URL("../../src/lib/knowledge-library/validation.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { libraryText } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const form = new FormData();
for (const body of ["First paragraph\nSecond paragraph", "First\r\nSecond", "First\n\n\tIndented", "Unicode café — ✓"]) {
  form.set("body", body);
  assert.equal(libraryText(form, "body", 100000, true, true), body);
}
for (let code = 0; code < 32; code++) {
  if ([9, 10, 13].includes(code)) continue;
  form.set("body", `Before${String.fromCharCode(code)}After`);
  assert.throws(() => libraryText(form, "body", 100000, true, true), /Invalid body/);
}
form.set("body", "x".repeat(100001));
assert.throws(() => libraryText(form, "body", 100000, false, true), /Invalid body/);
form.set("body", " \n ");
assert.throws(() => libraryText(form, "body", 100000, true, true), /Invalid body/);
assert.equal(libraryText(form, "body", 100000, false, true), "");
form.set("title", "First\nSecond");
assert.throws(() => libraryText(form, "title", 240, true), /Invalid title/);
form.set("title", "  Normal title  ");
assert.equal(libraryText(form, "title", 240, true), "Normal title");
const actions = readFileSync(new URL("../../src/lib/knowledge-library/actions.ts", import.meta.url), "utf8");
assert.match(actions, /target_body: text\(form, "body", 100000, false, true\)/);
assert.match(actions, /target_summary: text\(form, "summary", 5000, false, true\)/);
console.log("Library text validation regression checks passed.");
