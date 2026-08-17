# idd-claude — Plan 5 : dette de tests et dimension `acceptance`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Solder la dette de tests que le rapport de mutation a chiffrée, puis rendre la dimension `acceptance` réellement évaluable — ce qui achève `spec_as_source`.

**Architecture:** Inchangée. Les briques Gherkin (extracteur JS et Python, config cucumber, linter, gabarits) sont **déjà vendorées** depuis le Plan 1 dans `skills/acceptance-test-authoring/references/` — ce plan ne les réécrit pas, il les exerce, les câble et les scaffolde.

**Tech Stack:** Node 22, vitest, Stryker, cucumber-js, `yaml`, OpenSpec ≥ 1.9.0, Superpowers ≥ 6.3.0.

**Spec:** `docs/superpowers/specs/2026-08-17-idd-claude-design.md`

## Global Constraints

- Reprend les contraintes des Plans 1 à 4.
- **`spec_as_source` reste désactivé par défaut**, et c'est lui qui pilote la dimension `acceptance`.
- Ne pas réécrire l'extracteur amont. Il fonctionne, il est vendoré, il est couvert par `skills-lock.json`.
- Une dimension activée mais non évaluable rend `UNKNOWN` → `BLOCK`, jamais 0.

---

### Task 1: Solder la dette de tests

**Files:**
- Modify: `tests/tasks.test.mjs`, `tests/openspec-version.test.mjs`

**Interfaces:**
- Consumes: rien
- Produces: rien de nouveau — seulement des tests.

**Pourquoi maintenant.** Le run Stryker du Plan 4 a chiffré deux faiblesses : `tasks.mjs` à **64,79 %** (25 mutants survivants) et `openspec-version.mjs` à **67,80 %** (10 survivants, dont 9 non couverts). Ce plan ajoute du Gherkin à côté du parseur de tâches ; consolider d'abord évite de bâtir sur du sable. Et il serait incohérent de livrer un outil qui dit « vos tests sont faibles » en ignorant ce qu'il dit des nôtres.

**Ce que les survivants révèlent.** Les tests actuels de `tasks.mjs` nourrissent le parseur d'entrées bien formées et vérifient ce qu'il **accepte**. Les mutants qui survivent sont des relâchements de frontières de regex — donc rien ne vérifie ce qu'il **rejette**. Pour `openspec-version.mjs`, les 9 `NoCoverage` sont le corps de `defaultRun`, jamais exécuté puisque les tests injectent toujours un `run` factice.

- [ ] **Step 1: Écrire les tests de rejet du parseur**

Ajouter à `tests/tasks.test.mjs` :

```javascript
test('only a level-two heading opens a group', () => {
  assert.equal(parseTasks('### 1. Not a group\n- [ ] 1.1 RED x\n').length, 0)
  assert.equal(parseTasks('# 1. Not a group\n- [ ] 1.1 RED x\n').length, 0)
})

test('a group heading must carry a number and a dot', () => {
  assert.equal(parseTasks('## Token generation\n- [ ] 1.1 RED x\n').length, 0)
  assert.equal(parseTasks('## 1 Token generation\n- [ ] 1.1 RED x\n').length, 0)
})

test('a multi-digit group number is read whole', () => {
  const [group] = parseTasks('## 12. Twelfth\n- [ ] 12.1 RED x\n')
  assert.equal(group.number, 12)
})

test('a task outside any group is ignored rather than crashing', () => {
  assert.deepEqual(parseTasks('- [ ] 1.1 RED orphan\n'), [])
})

test('the checkbox must be well formed', () => {
  const malformed = [
    '## 1. G\n- [] 1.1 RED x\n',
    '## 1. G\n- [ ]1.1 RED x\n',
    '## 1. G\n-[ ] 1.1 RED x\n',
    '## 1. G\n* [ ] 1.1 RED x\n',
  ]
  for (const source of malformed) {
    assert.equal(parseTasks(source)[0].tasks.length, 0, `should not parse: ${JSON.stringify(source)}`)
  }
})

test('an X in the checkbox is accepted in either case', () => {
  assert.equal(parseTasks('## 1. G\n- [X] 1.1 RED x\n')[0].tasks[0].done, true)
})

test('a single-space indent is not a continuation line', () => {
  const [group] = parseTasks('## 1. G\n- [ ] 1.1 VISUAL x\n url: /\n')
  assert.deepEqual(group.tasks[0].lines, [])
})

test('a continuation line must contain something', () => {
  const [group] = parseTasks('## 1. G\n- [ ] 1.1 VISUAL x\n      \n      url: /\n')
  assert.deepEqual(group.tasks[0].lines, ['url: /'])
})

test('continuation lines stop at the next task', () => {
  const [group] = parseTasks(
    '## 1. G\n- [ ] 1.1 VISUAL x\n      url: /\n- [ ] 1.2 RED y\n      note\n',
  )
  assert.deepEqual(group.tasks[0].lines, ['url: /'])
  assert.deepEqual(group.tasks[1].lines, ['note'])
})

test('an empty group is still a group', () => {
  const groups = parseTasks('## 1. Empty\n\n## 2. Also empty\n')
  assert.equal(groups.length, 2)
  assert.deepEqual(groups[0].tasks, [])
})

test('a keyword is matched exactly, not as a prefix', () => {
  // REDO must not be read as RED.
  const [group] = parseTasks('## 1. G\n- [ ] 1.1 REDO the thing\n')
  assert.equal(group.tasks[0].type, null)
  assert.equal(group.tasks[0].description, 'REDO the thing')
})
```

- [ ] **Step 2: Écrire le test d'intégration de la détection de version**

Ajouter à `tests/openspec-version.test.mjs` :

```javascript
test('detectOpenspec finds the real CLI when no runner is injected', () => {
  // The other tests inject a fake runner, so defaultRun is never executed and
  // its body goes unmutated-and-uncovered. This exercises it for real: the
  // plan's own prerequisite is that openspec >= 1.9 is on PATH.
  const result = detectOpenspec()
  assert.equal(result.installed, true)
  assert.match(result.version, /^\d+\.\d+\.\d+$/)
  assert.equal(result.satisfies, true)
})
```

- [ ] **Step 3: Lancer la suite**

```bash
npm test
```

Attendu : tous verts. Un échec du test d'intégration signifie qu'`openspec` n'est pas sur le PATH ou est trop ancien — c'est un prérequis du projet, pas un défaut du test.

- [ ] **Step 4: Mesurer le gain**

```bash
./node_modules/.bin/stryker run
```

Attendu : `tasks.mjs` et `openspec-version.mjs` nettement au-dessus de 70, et le score global au-dessus de 80. Noter les deux scores dans le message de commit. **Si un fichier reste sous 70**, ouvrir `reports/mutation/index.html` et traiter les survivants restants un par un plutôt que d'accepter le chiffre.

- [ ] **Step 5: Commit**

```bash
git add tests/
git commit -m "test: pin down what the task parser rejects, and cover the real version probe"
```

---

### Task 2: Exercer l'extracteur Gherkin vendoré

**Files:**
- Create: `tests/fixtures/gherkin/openspec/specs/demo/spec.md`
- Test: `tests/gherkin-extraction.test.mjs`

**Interfaces:**
- Consumes: `skills/acceptance-test-authoring/references/javascript/extract-gherkin.cjs`
- Produces: rien — mais la garantie que le code tiers qu'on distribue fonctionne, et une description exécutable de son contrat.

**Pourquoi.** L'extracteur est vendoré depuis l'amont et n'a jamais été exercé ici. On le **distribue** : s'il casse à une mise à jour amont, ou si son contrat diffère de ce que la skill décrit, on l'apprend chez un utilisateur. Ce test est la seule chose qui rattache notre documentation à son comportement réel.

- [ ] **Step 1: Écrire la fixture**

Créer `tests/fixtures/gherkin/openspec/specs/demo/spec.md` :

````markdown
# demo Specification

## Purpose

Demonstrate fenced Gherkin extraction.

## Requirements

### Requirement: Magic link request

The system SHALL issue a single-use link.

#### Scenario: A known email receives a link

```gherkin
Given a registered user
When they request a magic link
Then they receive an email containing a single-use link
```

#### Scenario: An unknown email is silently ignored

```gherkin
Given no account for the address
When a magic link is requested
Then no email is sent
```
````

- [ ] **Step 2: Écrire le test qui échoue**

Créer `tests/gherkin-extraction.test.mjs` :

```javascript
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, readdirSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const pluginRoot = fileURLToPath(new URL('../', import.meta.url))
const extractor = join(
  pluginRoot,
  'skills/acceptance-test-authoring/references/javascript/extract-gherkin.cjs',
)
const fixture = join(pluginRoot, 'tests', 'fixtures', 'gherkin')

const extracted = () => {
  const dir = mkdtempSync(join(tmpdir(), 'idd-gherkin-'))
  cpSync(fixture, dir, { recursive: true })
  const out = join(dir, 'acceptance-tests', '.extracted')
  execFileSync('node', [extractor, join(dir, 'openspec'), out], { encoding: 'utf8' })
  return out
}

test('the extractor turns a fenced spec into a .feature file', () => {
  const out = extracted()
  assert.ok(existsSync(out), 'the output directory must be created')
  const features = readdirSync(out, { recursive: true }).filter((f) => String(f).endsWith('.feature'))
  assert.ok(features.length > 0, 'at least one .feature must be written')
})

test('headings become Feature and Scenario, fences become steps', () => {
  const out = extracted()
  const file = readdirSync(out, { recursive: true }).find((f) => String(f).endsWith('.feature'))
  const feature = readFileSync(join(out, String(file)), 'utf8')

  assert.match(feature, /^Feature:/m, 'the capability heading must become a Feature')
  assert.match(feature, /Scenario: A known email receives a link/)
  assert.match(feature, /Scenario: An unknown email is silently ignored/)
  assert.match(feature, /Given a registered user/)
  assert.match(feature, /Then no email is sent/)
})

test('prose outside the fences does not leak into the steps', () => {
  const out = extracted()
  const file = readdirSync(out, { recursive: true }).find((f) => String(f).endsWith('.feature'))
  const feature = readFileSync(join(out, String(file)), 'utf8')
  assert.doesNotMatch(feature, /SHALL issue a single-use link/)
  assert.doesNotMatch(feature, /```/)
})
```

- [ ] **Step 3: Lancer le test**

```bash
npm test
```

Il peut **passer du premier coup** — l'extracteur existe déjà. Ce n'est pas un cycle RED/GREEN classique : on caractérise du code tiers, on ne le développe pas. Si un test échoue, c'est que le contrat réel diffère de ce que décrit `skills/acceptance-test-authoring/SKILL.md` : corriger alors la **documentation**, pas l'extracteur, et le dire dans le commit.

- [ ] **Step 4: Commit**

```bash
git add tests/fixtures/gherkin tests/gherkin-extraction.test.mjs
git commit -m "test: characterise the vendored Gherkin extractor"
```

---

### Task 3: `acceptance-cli.mjs`

**Files:**
- Create: `scripts/lib/acceptance.mjs`, `scripts/acceptance-cli.mjs`
- Test: `tests/acceptance.test.mjs`

**Interfaces:**
- Consumes: l'extracteur (Task 2)
- Produces: `readCucumberScore(report: object[]) => number | 'UNKNOWN'` et la commande `node scripts/acceptance-cli.mjs <projectRoot>` imprimant `{score}` ou `{score: "UNKNOWN", error}`.

**Format lu.** cucumber-js avec `--format json` produit un tableau de features, chacune avec `elements[]` (les scénarios), chacun avec `steps[]` portant `result.status` (`passed`, `failed`, `skipped`, `undefined`, `pending`). Un scénario compte pour réussi si **tous** ses steps sont `passed`.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `tests/acceptance.test.mjs` :

```javascript
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readCucumberScore } from '../scripts/lib/acceptance.mjs'

const scenario = (...statuses) => ({ steps: statuses.map((status) => ({ result: { status } })) })
const report = (...scenarios) => [{ elements: scenarios }]

test('all scenarios passing scores 100', () => {
  assert.equal(readCucumberScore(report(scenario('passed', 'passed'), scenario('passed'))), 100)
})

test('a failing step fails its whole scenario', () => {
  assert.equal(readCucumberScore(report(scenario('passed', 'failed'), scenario('passed'))), 50)
})

test('an undefined step fails its scenario', () => {
  // An undefined step means a Given/When/Then with no step definition behind
  // it. The scenario proves nothing; counting it as passed would be a lie.
  assert.equal(readCucumberScore(report(scenario('passed', 'undefined'))), 0)
})

test('a pending step fails its scenario', () => {
  assert.equal(readCucumberScore(report(scenario('pending'))), 0)
})

test('a skipped step fails its scenario', () => {
  assert.equal(readCucumberScore(report(scenario('passed', 'skipped'))), 0)
})

test('scenarios are counted across every feature', () => {
  const twoFeatures = [
    { elements: [scenario('passed'), scenario('passed')] },
    { elements: [scenario('failed'), scenario('passed')] },
  ]
  assert.equal(readCucumberScore(twoFeatures), 75)
})

test('an empty report is UNKNOWN rather than 100', () => {
  // No scenario ran. Reporting 100 would hand out a free pass.
  assert.equal(readCucumberScore([]), 'UNKNOWN')
  assert.equal(readCucumberScore([{ elements: [] }]), 'UNKNOWN')
})

test('a scenario with no steps does not count as passed', () => {
  assert.equal(readCucumberScore(report({ steps: [] })), 'UNKNOWN')
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

```bash
npm test
```

Attendu : `Cannot find module ... scripts/lib/acceptance.mjs`.

- [ ] **Step 3: Écrire la lecture du rapport**

Créer `scripts/lib/acceptance.mjs` :

```javascript
export const UNKNOWN = 'UNKNOWN'

// Only `passed` proves anything. `undefined` means the step has no definition
// behind it, `pending` means it is a stub, `skipped` means it never ran —
// none of them demonstrate the behaviour.
const PASSED = 'passed'

function scenarioPassed(scenario) {
  const steps = scenario.steps ?? []
  if (steps.length === 0) return false
  return steps.every((step) => step.result?.status === PASSED)
}

export function readCucumberScore(report) {
  const scenarios = (report ?? []).flatMap((feature) => feature.elements ?? [])
  const runnable = scenarios.filter((s) => (s.steps ?? []).length > 0)

  if (runnable.length === 0) return UNKNOWN

  const passed = runnable.filter(scenarioPassed).length
  return Math.round((100 * passed) / runnable.length)
}
```

- [ ] **Step 4: Écrire le CLI**

Créer `scripts/acceptance-cli.mjs` :

```javascript
#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readCucumberScore, UNKNOWN } from './lib/acceptance.mjs'

const projectRoot = process.argv[2] ?? process.cwd()
const pluginRoot = fileURLToPath(new URL('../', import.meta.url))
const extractor = join(
  pluginRoot,
  'skills/acceptance-test-authoring/references/javascript/extract-gherkin.cjs',
)
const extractedDir = join(projectRoot, 'acceptance-tests', '.extracted')
const reportPath = join(projectRoot, 'acceptance-tests', 'report.json')

try {
  // Specs are the source: regenerate the .feature files every run, so a stale
  // extraction can never be what the gate scores.
  execFileSync('node', [extractor, join(projectRoot, 'openspec'), extractedDir], {
    encoding: 'utf8',
    stdio: 'pipe',
  })
  execFileSync(
    join(projectRoot, 'node_modules', '.bin', 'cucumber-js'),
    ['--format', `json:${reportPath}`],
    { cwd: projectRoot, encoding: 'utf8', stdio: 'pipe' },
  )
} catch (error) {
  // cucumber-js exits non-zero when scenarios fail, which is a real score, not
  // an infrastructure failure — so only report UNKNOWN if no report was
  // written at all.
  try {
    readFileSync(reportPath, 'utf8')
  } catch {
    console.log(JSON.stringify({ score: UNKNOWN, error: firstLine(error) }))
    process.exit(0)
  }
}

try {
  console.log(
    JSON.stringify({ score: readCucumberScore(JSON.parse(readFileSync(reportPath, 'utf8'))) }),
  )
} catch (error) {
  console.log(JSON.stringify({ score: UNKNOWN, error: firstLine(error) }))
}

function firstLine(error) {
  return String(error.stderr ?? error.message)
    .replace(/\[[0-9;]*m/g, '')
    .trim()
    .split('\n')[0]
}
```

Le `try` imbriqué est le point délicat : cucumber sort en code non-zéro **quand des scénarios échouent**, ce qui est un score légitime et non une panne. On ne rend `UNKNOWN` que si aucun rapport n'a été écrit.

- [ ] **Step 5: Lancer les tests**

```bash
npm test
```

Attendu : les 8 nouveaux tests passent.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/acceptance.mjs scripts/acceptance-cli.mjs tests/acceptance.test.mjs
git commit -m "feat: score the acceptance dimension from a cucumber-js run"
```

---

### Task 4: Câblage et scaffolding

**Files:**
- Modify: `agents/evaluator.md`, `commands/idd/apply.md`, `commands/idd/init.md`, `README.md`
- Modify: `tests/evaluator-contract.test.mjs`

**Interfaces:**
- Consumes: `acceptance-cli.mjs` (Task 3)
- Produces: la dimension `acceptance` évaluable quand `spec_as_source: true`.

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter à `tests/evaluator-contract.test.mjs` :

```javascript
test('the evaluator runs the acceptance suite through the CLI', () => {
  const body = readFileSync(agentPath, 'utf8')
  assert.match(body, /acceptance-cli\.mjs/)
  assert.match(body, /spec_as_source/)
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

```bash
npm test
```

- [ ] **Step 3: Câbler l'évaluateur**

Dans `agents/evaluator.md`, remplacer l'étape 7 :

```markdown
7. **Score `acceptance`** if the dimension is enabled — it is exactly when
   `spec_as_source: true`. Run:

   `node "${CLAUDE_PLUGIN_ROOT}/scripts/acceptance-cli.mjs" .`

   It re-extracts the `.feature` files from the specs before running, so a
   stale extraction can never be what you score. Report the number it prints,
   or `"UNKNOWN"` if it returns that.

   A failing scenario is a gap between the spec and the code. Say which of the
   two is wrong in your findings: fixing the code and fixing the spec are very
   different fix tasks.
```

- [ ] **Step 4: Compléter le pré-contrôle d'apply**

Dans `commands/idd/apply.md`, ajouter au pré-contrôle :

```markdown
- `spec_as_source: true` but `acceptance-tests/` is missing, or `cucumber-js`
  is not installed in the project → stop, say which. Run `/idd:init --acceptance`
  to scaffold it.
```

- [ ] **Step 5: Ajouter le scaffolding à `/idd:init`**

Dans `commands/idd/init.md`, ajouter une section finale :

```markdown
## Optional: acceptance scaffolding

When the user passes `--acceptance`, or turns on `verification.spec_as_source`,
set the project up for executable Gherkin:

1. Read `skills/acceptance-test-authoring/references/javascript/SETUP.md` and
   follow it for the stack recorded in `openspec/config.yaml`.
2. Copy `references/javascript/cucumber.cjs` to the project root and install
   `@cucumber/cucumber` as a dev dependency.
3. Create `acceptance-tests/steps/` for the step definitions, and add
   `acceptance-tests/.extracted/` and `acceptance-tests/report.json` to
   `.gitignore` — both are regenerated on every run.

Do not hand-write `.feature` files: they are extracted from the specs, and
anything written by hand there is overwritten on the next run.
```

- [ ] **Step 6: Documenter**

Dans `README.md`, ajouter à la table des prérequis une ligne pour `@cucumber/cucumber`, requis dans le projet cible uniquement pour la dimension `acceptance`, désactivée par défaut.

- [ ] **Step 7: Lancer les tests**

```bash
npm test
```

Attendu : toute la suite verte.

- [ ] **Step 8: Commit**

```bash
git add agents/ commands/ README.md tests/
git commit -m "feat: wire the acceptance dimension and scaffold the cucumber setup"
```

---

## Auto-relecture

**Couverture de la spec.** Ce plan achève `spec_as_source` : extraction exercée, dimension `acceptance` notée, scaffolding documenté. Avec lui, les six dimensions de l'évaluateur sont toutes réellement évaluables. **Reportés sans échéance** : le pack PHP (Behat/Infection) et le mode mutation strict par lignes ajoutées — leurs déclencheurs sont dans la spec.

**Deux tâches qui ne suivent pas un cycle RED/GREEN classique.** La Task 2 caractérise du code tiers déjà écrit : ses tests peuvent passer immédiatement, et c'est normal — le plan le dit explicitement pour que l'exécutant ne cherche pas un échec qui ne viendra pas. La Task 1 n'ajoute que des tests, et sa vérification n'est pas « le test passe » mais « le score de mutation monte », mesuré à l'étape 4.

**Un piège de conception traité.** `cucumber-js` sort en code non-zéro dès qu'un scénario échoue. Traiter cette sortie comme une panne rendrait `UNKNOWN` — donc `BLOCK` — à chaque fois qu'un test d'acceptation échoue légitimement, ce qui masquerait un vrai échec derrière un problème d'infrastructure supposé. Le CLI ne rend `UNKNOWN` que si aucun rapport n'a été écrit.

**Types.** `readCucumberScore` rend un nombre **ou** `'UNKNOWN'`, comme `readMutationScore` (Plan 4) et `visual-cli.mjs` (Plan 3) : les quatre chemins convergent sur la même valeur littérale que `computeVerdict` traite déjà comme non évaluée.
