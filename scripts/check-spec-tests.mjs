// Checks the `Test:` line that ends every scenario in openspec/specs/*/spec.md:
// each scenario must have one, and every test it names must exist.
// Format: Test: tests/<file>.test.ts › "<test name>" (more refs may follow, separated by `;`),
// or Test: none yet. A note in brackets may follow either.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const specsDir = "openspec/specs";
const refPattern = /(tests\/[^\s›]+)\s*›\s*"([^"]+)"/g;
const problems = [];
let checked = 0;

for (const capability of readdirSync(specsDir, { withFileTypes: true })) {
  if (!capability.isDirectory()) continue;
  const specPath = join(specsDir, capability.name, "spec.md");
  if (!existsSync(specPath)) continue;
  const lines = readFileSync(specPath, "utf8").split("\n");

  let scenario = null; // { name, line, hasTest }
  const closeScenario = () => {
    if (scenario && !scenario.hasTest) {
      problems.push(`${specPath}:${scenario.line} scenario "${scenario.name}" has no Test: line`);
    }
    scenario = null;
  };

  lines.forEach((text, i) => {
    const lineNo = i + 1;
    if (/^#{1,4} /.test(text)) {
      closeScenario();
      const m = /^#### Scenario:\s*(.+)$/.exec(text);
      if (m) scenario = { name: m[1].trim(), line: lineNo, hasTest: false };
      return;
    }
    if (!text.startsWith("Test:")) return;
    if (!scenario) {
      problems.push(`${specPath}:${lineNo} Test: line outside a scenario`);
      return;
    }
    scenario.hasTest = true;
    checked++;
    const value = text.slice("Test:".length).trim();
    if (/^none yet\b/.test(value)) return;
    const refs = [...value.matchAll(refPattern)];
    if (refs.length === 0) {
      problems.push(`${specPath}:${lineNo} can't read "${value}": expected tests/<file>.test.ts › "<name>" or none yet`);
      return;
    }
    for (const [, file, name] of refs) {
      if (!existsSync(file)) {
        problems.push(`${specPath}:${lineNo} test file ${file} not found`);
        continue;
      }
      const source = readFileSync(file, "utf8");
      if (![`"${name}"`, `'${name}'`, `\`${name}\``].some((q) => source.includes(q))) {
        problems.push(`${specPath}:${lineNo} no test named "${name}" in ${file}`);
      }
    }
  });
  closeScenario();
}

if (problems.length > 0) {
  console.error(`Spec test references: ${problems.length} problem(s)`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log(`✓ spec test references (${checked} scenarios)`);
