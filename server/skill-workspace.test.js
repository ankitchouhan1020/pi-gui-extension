import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { cleanupTestCwd, makeTestCwd } from "./test-temp.js";
import {
  createSkillMarkdown,
  describeSkills,
  saveSkillMarkdown,
  skillRoots,
  validateSkillMarkdown,
  validateSkillName,
} from "./skill-workspace.js";

const VALID = `---
name: review-code
description: Review code carefully before it ships.
---

# Review code

Check behavior and tests.
`;

describe("skill workspace", () => {
  it("validates Agent Skills names and required frontmatter", () => {
    assert.equal(validateSkillName("review-code"), "review-code");
    assert.throws(() => validateSkillName("Review Code"), /lowercase/);
    assert.throws(
      () => validateSkillMarkdown("# Missing frontmatter"),
      /description is required/,
    );
    assert.equal(
      validateSkillMarkdown(VALID, "review-code").description,
      "Review code carefully before it ships.",
    );
  });

  it("creates and edits project skills only through their loaded path", async () => {
    const cwd = makeTestCwd("pi-gui-skills-");
    try {
      const created = await createSkillMarkdown(cwd, {
        scope: "project",
        name: "review-code",
        content: VALID,
      });
      assert.equal(created.filePath, `${skillRoots(cwd).project}/review-code/SKILL.md`);
      assert.equal(await readFile(created.filePath, "utf8"), VALID);

      const loaded = {
        name: "review-code",
        description: "Review code carefully before it ships.",
        filePath: created.filePath,
        sourceInfo: { source: "local", scope: "project" },
      };
      const workspace = describeSkills(cwd, [loaded]);
      assert.equal(workspace.skills[0].editable, true);
      assert.equal(workspace.skills[0].editableScope, "project");

      const updated = VALID.replace("Check behavior", "Check correctness");
      await saveSkillMarkdown(cwd, [loaded], created.filePath, updated);
      assert.equal(await readFile(created.filePath, "utf8"), updated);
      await assert.rejects(
        () => saveSkillMarkdown(cwd, [loaded], `${cwd}/elsewhere/SKILL.md`, updated),
        /not loaded/,
      );
    } finally {
      cleanupTestCwd(cwd);
    }
  });
});
