import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  CONFIG_DIR_NAME,
  getAgentDir,
  parseFrontmatter,
} from "@earendil-works/pi-coding-agent";

const MAX_SKILL_BYTES = 1024 * 1024;

/** @param {string} cwd @param {string} [agentDir] */
export function skillRoots(cwd, agentDir = getAgentDir()) {
  return {
    user: path.join(agentDir, "skills"),
    project: path.resolve(cwd, CONFIG_DIR_NAME, "skills"),
  };
}

/** @param {string} target @param {string} root */
function isUnder(target, root) {
  const resolvedTarget = path.resolve(target);
  const resolvedRoot = path.resolve(root);
  return (
    resolvedTarget === resolvedRoot ||
    resolvedTarget.startsWith(resolvedRoot + path.sep)
  );
}

/** @param {string} filePath @param {{ user: string, project: string }} roots */
export function editableSkillScope(filePath, roots) {
  if (isUnder(filePath, roots.user)) return "user";
  if (isUnder(filePath, roots.project)) return "project";
  return null;
}

/** @param {string} name */
export function validateSkillName(name) {
  const value = String(name || "").trim();
  if (!value) throw new Error("Skill name is required");
  if (value.length > 64) throw new Error("Skill name must be 64 characters or fewer");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new Error("Skill name must use lowercase letters, numbers, and single hyphens");
  }
  return value;
}

/** @param {string} content @param {string} [expectedName] */
export function validateSkillMarkdown(content, expectedName) {
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Skill Markdown is required");
  }
  if (Buffer.byteLength(content, "utf8") > MAX_SKILL_BYTES) {
    throw new Error("Skill Markdown must be smaller than 1 MB");
  }
  const { frontmatter } = parseFrontmatter(content);
  const description =
    typeof frontmatter.description === "string"
      ? frontmatter.description.trim()
      : "";
  if (!description) throw new Error("Frontmatter description is required");
  if (description.length > 1024) {
    throw new Error("Skill description must be 1024 characters or fewer");
  }
  if (frontmatter.name != null) {
    const parsedName = validateSkillName(String(frontmatter.name));
    if (expectedName && parsedName !== expectedName) {
      throw new Error(`Frontmatter name must match ${expectedName}`);
    }
  }
  return { frontmatter, description };
}

/**
 * @param {string} cwd
 * @param {any[]} skills
 * @param {any[]} [diagnostics]
 */
export function describeSkills(cwd, skills, diagnostics = []) {
  const roots = skillRoots(cwd);
  return {
    roots,
    diagnostics,
    skills: skills.map((skill) => {
      const editableScope = editableSkillScope(skill.filePath, roots);
      return {
        name: skill.name,
        description: skill.description || "",
        filePath: skill.filePath,
        disableModelInvocation: Boolean(skill.disableModelInvocation),
        source: skill.sourceInfo?.source,
        scope: skill.sourceInfo?.scope,
        origin: skill.sourceInfo?.origin,
        editable: Boolean(editableScope),
        editableScope,
      };
    }),
  };
}

/** @param {string} cwd @param {any[]} skills @param {string} filePath */
export async function readSkillMarkdown(cwd, skills, filePath) {
  const resolved = path.resolve(String(filePath || ""));
  const skill = skills.find((item) => path.resolve(item.filePath) === resolved);
  if (!skill) throw new Error("Skill is not loaded in this session");
  return {
    filePath: skill.filePath,
    content: await readFile(skill.filePath, "utf8"),
    editable: Boolean(editableSkillScope(skill.filePath, skillRoots(cwd))),
  };
}

/** @param {string} cwd @param {any[]} skills @param {string} filePath @param {string} content */
export async function saveSkillMarkdown(cwd, skills, filePath, content) {
  const resolved = path.resolve(String(filePath || ""));
  const skill = skills.find((item) => path.resolve(item.filePath) === resolved);
  if (!skill) throw new Error("Skill is not loaded in this session");
  if (!editableSkillScope(resolved, skillRoots(cwd))) {
    throw new Error("Package and temporary skills are read-only");
  }
  validateSkillMarkdown(content, skill.name);
  await writeFile(resolved, content, "utf8");
  return { filePath: resolved };
}

/**
 * @param {string} cwd
 * @param {{ scope: "user" | "project", name: string, content: string }} input
 */
export async function createSkillMarkdown(cwd, input) {
  const scope = input?.scope === "user" ? "user" : "project";
  const name = validateSkillName(input?.name);
  validateSkillMarkdown(input?.content, name);
  const root = skillRoots(cwd)[scope];
  const dir = path.join(root, name);
  const filePath = path.join(dir, "SKILL.md");
  await mkdir(dir, { recursive: true });
  try {
    await writeFile(filePath, input.content, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if (error && typeof error === "object" && error.code === "EEXIST") {
      throw new Error(`A ${scope} skill named ${name} already exists`);
    }
    throw error;
  }
  return { filePath, scope, name };
}
