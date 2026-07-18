import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  bashOutputPresentation,
  builtinToolPresentation,
} from "./tool-presentation.ts";

describe("builtinToolPresentation", () => {
  it("renders bash as a command with compact timeout metadata", () => {
    const view = builtinToolPresentation(
      {
        type: "toolCall",
        name: "bash",
        arguments: { command: "npm test", timeout: 120 },
      },
      { role: "toolResult" },
      "42 tests passed",
    );
    assert.equal(view?.title, "$ npm test");
    assert.equal(view?.meta, "timeout 120s");
    assert.equal(view?.args, "");
    assert.equal(view?.resultLabel, "output");
    assert.equal(view?.result, "42 tests passed");
    assert.equal(view?.resultLang, "bash");
  });

  it("renders git diff bash output like an edit diff", () => {
    const view = builtinToolPresentation(
      {
        type: "toolCall",
        name: "bash",
        arguments: { command: "git diff --cached" },
      },
      { role: "toolResult" },
      "diff --git a/a.ts b/a.ts\n-old\n+new",
    );
    assert.equal(view?.resultLabel, "diff");
    assert.equal(view?.resultKind, "diff");
    assert.equal(view?.resultLang, "diff");
  });

  it("recognizes git diff with cwd and shell prefixes", () => {
    assert.deepEqual(bashOutputPresentation("FOO=1 git -C repo diff -- src"), {
      label: "diff",
      kind: "diff",
      lang: "diff",
    });
    assert.equal(bashOutputPresentation("npm test").lang, "bash");
  });

  it("turns edit arguments into a readable diff preview", () => {
    const view = builtinToolPresentation(
      {
        type: "toolCall",
        name: "edit",
        arguments: {
          path: "src/app.ts",
          edits: [{ oldText: "const old = 1;", newText: "const next = 2;" }],
        },
      },
      undefined,
      "",
    );
    assert.equal(view?.title, "edit src/app.ts");
    assert.match(view?.result ?? "", /-const old = 1;/);
    assert.match(view?.result ?? "", /\+const next = 2;/);
    assert.equal(view?.resultKind, "diff");
  });

  it("prefers the completed edit diff from result details", () => {
    const view = builtinToolPresentation(
      {
        type: "toolCall",
        name: "edit",
        arguments: { path: "a.ts", edits: [{ oldText: "a", newText: "b" }] },
      },
      { role: "toolResult", details: { diff: "-actual\n+result" } },
      "Applied",
    );
    assert.equal(view?.result, "-actual\n+result");
  });

  it("shows an edit error instead of the proposed preview", () => {
    const view = builtinToolPresentation(
      {
        type: "toolCall",
        name: "edit",
        arguments: { path: "a.ts", edits: [{ oldText: "a", newText: "b" }] },
      },
      { role: "toolResult", isError: true },
      "Old text was not found",
    );
    assert.equal(view?.result, "Old text was not found");
    assert.equal(view?.resultKind, "code");
  });

  it("formats read ranges and keeps file content out of JSON args", () => {
    const view = builtinToolPresentation(
      {
        type: "toolCall",
        name: "read",
        arguments: { path: "src/app.ts", offset: 10, limit: 5 },
      },
      { role: "toolResult" },
      "export const app = true;",
    );
    assert.equal(view?.title, "read src/app.ts:10-14");
    assert.equal(view?.args, "");
    assert.equal(view?.resultKind, "code");
  });

  it("shows write content as highlighted content instead of JSON", () => {
    const view = builtinToolPresentation(
      {
        type: "toolCall",
        name: "write",
        arguments: { path: "src/new.ts", content: "export const value = 1;" },
      },
      { role: "toolResult" },
      "Wrote 23 bytes",
    );
    assert.equal(view?.title, "write src/new.ts");
    assert.equal(view?.argsLabel, "content");
    assert.equal(view?.args, "export const value = 1;");
    assert.equal(view?.argsKind, "code");
    assert.equal(view?.result, "Wrote 23 bytes");
  });
});
