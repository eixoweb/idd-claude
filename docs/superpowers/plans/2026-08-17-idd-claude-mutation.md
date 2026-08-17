# idd-claude — Plan 4 : dimension `runtime` désactivable, vitest, mutation testing

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre `runtime` désactivable pour les projets sans suite de tests, migrer le harnais vers vitest, et livrer la dimension `mutation` — la seule qui vérifie que les tests valent quelque chose.

**Architecture:** Inchangée. La lecture du rapport Stryker est une fonction pure dans `scripts/lib/mutation.mjs`, testée sur des rapports fabriqués ; l'exécution de Stryker est une coquille mince (`scripts/mutation-cli.mjs`) que les tests n'exercent pas, sur le modèle de `visual-cli.mjs`.

**Tech Stack:** Node 22, **vitest** (remplace `node --test`), `yaml`, Stryker Mutator, dev-browser, OpenSpec ≥ 1.9.0, Superpowers ≥ 6.3.0.

**Spec:** `docs/superpowers/specs/2026-08-17-idd-claude-design.md`

## Global Constraints

- Reprend les contraintes des Plans 1 à 3 (anglais dans le repo, MIT, planchers, pas de dégradation silencieuse).
- **`mutation` reste désactivée par défaut.** Elle est coûteuse ; c'est un opt-in délibéré, comme `spec_as_source`.
- **Désactiver une dimension doit être une décision enregistrée, jamais un accident.** Un projet dont la config oublie ses commandes de test ne doit pas perdre silencieusement `runtime` — il doit être arrêté.

---

### Task 1: Rendre `runtime` désactivable

**Files:**
- Modify: `scripts/lib/config.mjs`, `scripts/lib/promote-schema.mjs`
- Modify: `commands/idd/apply.md`, `schema/templates/verification.md`, `schema-lite/templates/verification.md`
- Test: `tests/config.test.mjs`, `tests/promote-schema.test.mjs`

**Interfaces:**
- Consumes: rien
- Produces: `readVerification` reconnaît `verification.runtime` (défaut `true`). `enabled` peut désormais ne pas contenir `runtime`.

**Pourquoi un drapeau explicite plutôt qu'une déduction.** On pourrait activer `runtime` seulement quand `project.test_commands` est non vide. Ce serait un piège : un projet qui *devrait* avoir des tests mais dont la config est incomplète perdrait la dimension sans que personne ne le remarque — exactement la dégradation silencieuse que ce projet interdit. Avec un drapeau, ne pas avoir de tests est une décision inscrite dans la config, et une config incomplète reste une erreur qui arrête `/idd:apply`.

`spec` et `code` restent inconditionnelles : elles ne demandent aucune infrastructure, l'évaluateur les note à partir du diff et de la revue. Il n'y a donc pas de raison légitime de les couper.

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `tests/config.test.mjs`, remplacer le premier test et en ajouter trois :

```javascript
test('spec and code are always enabled', () => {
  const { enabled } = readVerification('verification:\n  runtime: false\n')
  assert.ok(enabled.includes('spec'))
  assert.ok(enabled.includes('code'))
})

test('runtime is enabled when the flag is absent', () => {
  assert.ok(readVerification('verification: {}').enabled.includes('runtime'))
})

test('runtime: false removes the dimension', () => {
  const { enabled } = readVerification('verification:\n  runtime: false\n')
  assert.ok(!enabled.includes('runtime'), 'an opted-out project must not be scored on runtime')
})

test('runtime: true is accepted explicitly', () => {
  assert.ok(readVerification('verification:\n  runtime: true\n').enabled.includes('runtime'))
})
```

Dans `tests/promote-schema.test.mjs`, ajouter à l'assertion de config par défaut :

```javascript
  assert.equal(config.verification.runtime, true)
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

```bash
node --test
```

Attendu : ÉCHEC sur `runtime: false removes the dimension` (la dimension est câblée en dur) et sur la clé absente de la config par défaut.

- [ ] **Step 3: Implémenter**

Dans `scripts/lib/config.mjs` :

```javascript
const ALWAYS_ON = ['spec', 'code']
```

et dans `readVerification`, avant les autres drapeaux :

```javascript
  const enabled = [...ALWAYS_ON]
  // Defaults to on: a project without tests must say so out loud.
  if (v.runtime !== false) enabled.push('runtime')
  if (v.visual) enabled.push('visual')
```

Dans `defaultConfig()` de `promote-schema.mjs`, sous `spec_as_source` :

```
  runtime: true                # set to false only for a project with no test suite
```

- [ ] **Step 4: Rendre la désactivation visible**

Dans `commands/idd/apply.md`, remplacer la troisième puce du pré-contrôle :

```markdown
- `runtime: true` (the default) but `project.test_commands` is empty → stop.
  Either configure the commands, or set `runtime: false` to record that this
  project has no test suite. Do not proceed with the dimension enabled and
  nothing to run: every group would BLOCK.
- `runtime: false` → say so at the start of the run. The change will be gated
  on `spec`, `code` and whatever else is enabled, and on nothing executable.
```

Dans les deux `templates/verification.md`, ajouter sous le tableau :

```markdown
**Dimensions disabled for this project**: `<list, or "none">`
```

Une dimension coupée doit apparaître dans le rapport : c'est ce qui distingue
un PASS restreint d'un PASS complet, six mois plus tard.

- [ ] **Step 5: Lancer les tests**

```bash
node --test
```

Attendu : toute la suite verte.

- [ ] **Step 6: Commit**

```bash
git add scripts/ commands/ schema/ schema-lite/ tests/
git commit -m "feat: make the runtime dimension opt-out for projects with no test suite"
```

---

### Task 2: Migration vers vitest

**Files:**
- Modify: `package.json`, tous les `tests/*.test.mjs`
- Create: `vitest.config.js`

**Interfaces:**
- Consumes: rien
- Produces: `npm test` lance vitest ; la Task 3 en dépend, Stryker ne pilotant pas `node --test` nativement.

**Pourquoi.** Stryker sait piloter jest, vitest, mocha, jasmine et cucumber, mais pas le lanceur intégré de Node. Sans migration, appliquer la dimension `mutation` à `idd-claude` lui-même imposerait le `command-runner` générique — plus lent, et incapable de rattacher un mutant au test qui le tue. Le coût est réel et à connaître : on passe d'**une** dépendance de dev à un arbre d'une centaine de paquets.

- [ ] **Step 1: Installer vitest**

```bash
npm install -D vitest
```

- [ ] **Step 2: Basculer les imports**

Un seul changement par fichier : la provenance de `test`. Les assertions restent en `node:assert/strict`, que vitest exécute sans adaptation — c'est ce qui rend la migration mécanique.

```bash
sed -i '' "s|^import { test } from 'node:test'$|import { test } from 'vitest'|" tests/*.test.mjs
grep -c "from 'vitest'" tests/*.test.mjs
```

Attendu : `1` pour chacun des neuf fichiers.

- [ ] **Step 3: Configurer**

Créer `vitest.config.js` :

```javascript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.mjs'],
    // The end-to-end tests spawn openspec and dev-browser; give them room.
    testTimeout: 60_000,
  },
})
```

Dans `package.json` :

```json
  "scripts": {
    "test": "vitest run"
  }
```

- [ ] **Step 4: Lancer la suite complète**

```bash
npm test
```

Attendu : **88 tests passent**, le même compte qu'avant la migration. Un écart signifie qu'un fichier n'est pas collecté — vérifier le motif `include`.

Point de vigilance : vitest exécute les fichiers en parallèle, là où `node --test` les séquençait. Nos tests créent leurs répertoires par `mkdtempSync` et ne partagent aucun état, donc le parallélisme est sûr — mais si un échec intermittent apparaît, c'est la première piste, et `--no-file-parallelism` l'isole.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.js tests/
git commit -m "build: migrate the test harness from node:test to vitest"
```

---

### Task 3: La dimension `mutation`

**Files:**
- Create: `scripts/lib/mutation.mjs`, `scripts/mutation-cli.mjs`, `stryker.config.json`
- Modify: `agents/evaluator.md`, `commands/idd/apply.md`, `README.md`
- Test: `tests/mutation.test.mjs`, `tests/evaluator-contract.test.mjs`

**Interfaces:**
- Consumes: `computeVerdict` (Plan 2)
- Produces: `readMutationScore(report: object) => number` et la commande `node scripts/mutation-cli.mjs <sinceRef>` qui imprime `{score}` ou `{score: "UNKNOWN", error}`.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `tests/mutation.test.mjs` :

```javascript
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readMutationScore } from '../scripts/lib/mutation.mjs'

const report = (statuses) => ({
  files: {
    'src/a.mjs': { mutants: statuses.map((status, id) => ({ id: String(id), status })) },
  },
})

test('every mutant killed scores 100', () => {
  assert.equal(readMutationScore(report(['Killed', 'Killed'])), 100)
})

test('a survivor lowers the score', () => {
  assert.equal(readMutationScore(report(['Killed', 'Survived'])), 50)
})

test('a timeout counts as killed', () => {
  // The mutant made the suite hang, which means a test did detect the change.
  assert.equal(readMutationScore(report(['Killed', 'Timeout'])), 100)
})

test('an uncovered mutant counts against the score', () => {
  // NoCoverage means no test even executes that code — the worst case, and the
  // one a coverage-blind score would hide.
  assert.equal(readMutationScore(report(['Killed', 'NoCoverage'])), 50)
})

test('compile errors and ignored mutants are excluded from the denominator', () => {
  assert.equal(readMutationScore(report(['Killed', 'CompileError', 'Ignored'])), 100)
})

test('a report with nothing scorable is UNKNOWN rather than 0 or 100', () => {
  // No scorable mutant means the run told us nothing. Reporting 100 would be a
  // free pass; reporting 0 would blame the implementation.
  assert.equal(readMutationScore(report(['CompileError'])), 'UNKNOWN')
  assert.equal(readMutationScore({ files: {} }), 'UNKNOWN')
})

test('mutants are counted across every file', () => {
  const multi = {
    files: {
      'a.mjs': { mutants: [{ status: 'Killed' }, { status: 'Killed' }] },
      'b.mjs': { mutants: [{ status: 'Survived' }, { status: 'Survived' }] },
    },
  }
  assert.equal(readMutationScore(multi), 50)
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

```bash
npm test
```

Attendu : `Cannot find module ... scripts/lib/mutation.mjs`.

- [ ] **Step 3: Écrire la lecture du rapport**

Créer `scripts/lib/mutation.mjs` :

```javascript
// Stryker statuses that mean a test noticed the change.
const DETECTED = new Set(['Killed', 'Timeout'])
// Statuses that mean it did not — including NoCoverage, where no test runs the
// mutated line at all.
const UNDETECTED = new Set(['Survived', 'NoCoverage'])

export const UNKNOWN = 'UNKNOWN'

export function readMutationScore(report) {
  let detected = 0
  let scorable = 0

  for (const file of Object.values(report?.files ?? {})) {
    for (const mutant of file.mutants ?? []) {
      if (DETECTED.has(mutant.status)) {
        detected += 1
        scorable += 1
      } else if (UNDETECTED.has(mutant.status)) {
        scorable += 1
      }
      // CompileError, Ignored, RuntimeError: not the suite's fault, excluded.
    }
  }

  if (scorable === 0) return UNKNOWN
  return Math.round((100 * detected) / scorable)
}
```

- [ ] **Step 4: Écrire la configuration et le CLI**

Créer `stryker.config.json` :

```json
{
  "$schema": "./node_modules/@stryker-mutator/core/schema/stryker-schema.json",
  "packageManager": "npm",
  "testRunner": "vitest",
  "reporters": ["json"],
  "jsonReporter": { "fileName": "reports/mutation/mutation.json" },
  "mutate": ["scripts/lib/**/*.mjs"],
  "coverageAnalysis": "perTest"
}
```

Créer `scripts/mutation-cli.mjs` :

```javascript
#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { readMutationScore, UNKNOWN } from './lib/mutation.mjs'

const [since] = process.argv.slice(2)
const args = ['stryker', 'run']
// Scope to the diff: a full run re-executes the suite once per mutant and is
// prohibitive inside a per-group gate.
if (since) args.push('--since', since)

try {
  execFileSync('npx', args, { encoding: 'utf8', stdio: 'pipe' })
} catch (error) {
  console.log(
    JSON.stringify({ score: UNKNOWN, error: firstLine(error) }),
  )
  process.exit(0)
}

try {
  const report = JSON.parse(readFileSync('reports/mutation/mutation.json', 'utf8'))
  console.log(JSON.stringify({ score: readMutationScore(report) }))
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

- [ ] **Step 5: Câbler l'évaluateur**

Dans `agents/evaluator.md`, remplacer l'étape 6 :

```markdown
6. **Score `mutation`** if the dimension is enabled. Run:

   `node "${CLAUDE_PLUGIN_ROOT}/scripts/mutation-cli.mjs" <baseRef>`

   where `<baseRef>` is the commit the group started from, so the run is scoped
   to the files it touched. Report the score it prints. If it returns
   `"UNKNOWN"` — the tool could not run, or produced no scorable mutant — report
   `"UNKNOWN"`, never 0.

   A surviving mutant is not a bug in the code: it is a test that would not have
   caught the bug. Phrase the findings that way, and generate fix tasks that add
   or strengthen tests rather than tasks that change behaviour.
```

Dans `tests/evaluator-contract.test.mjs`, ajouter :

```javascript
test('the evaluator runs the mutation tool through the CLI', () => {
  const body = readFileSync(agentPath, 'utf8')
  assert.match(body, /mutation-cli\.mjs/)
  assert.match(body, /--?\s*never 0|not 0/i)
})
```

Dans `commands/idd/apply.md`, préciser la puce du pré-contrôle :

```markdown
- `mutation: true` but no `stryker.config.json` in the project → stop, say so.
```

Dans `README.md`, ajouter sous « Prerequisites » une ligne indiquant que la
dimension `mutation` requiert Stryker installé dans le projet cible, et qu'elle
est désactivée par défaut.

- [ ] **Step 6: Lancer les tests**

```bash
npm test
```

Attendu : les 8 nouveaux tests passent, toute la suite avec.

- [ ] **Step 7: Vérifier Stryker sur ce repo**

```bash
npm install -D @stryker-mutator/core @stryker-mutator/vitest-runner
npx stryker run
```

Attendu : un score de mutation sur `scripts/lib/`. **Ce n'est pas un test automatisé** — c'est une vérification manuelle, unique, que la chaîne fonctionne de bout en bout sur un vrai projet. Noter le score obtenu dans le message de commit ; s'il est bas, ce sont nos propres tests qui sont faibles, et c'est une information utile.

- [ ] **Step 8: Commit**

```bash
git add scripts/ stryker.config.json agents/ commands/ README.md tests/ package.json package-lock.json
git commit -m "feat: mutation dimension scored from a diff-scoped Stryker run"
```

---

## Auto-relecture

**Couverture de la spec.** Ce plan livre la section « Mutation testing » en entier : dimension optionnelle et désactivée par défaut, Stryker pour le pack JS, scopage au diff par `--since`, plancher gradué à 70, `UNKNOWN` plutôt que 0. Il solde aussi le risque « le runner d'idd-claude n'est pas mutable en l'état » en tranchant pour la migration vitest. **Reporté au Plan 5** : spec-as-source. **Reporté sans échéance** : le pack PHP (Infection) et le mode strict « aucun survivant sur les lignes ajoutées ».

**Un choix de conception à signaler.** `NoCoverage` compte dans le dénominateur et pénalise le score. C'est le cas le plus grave — aucun test n'exécute la ligne mutée — et un décompte qui l'exclurait donnerait un score flatteur sur du code non couvert. Un test le verrouille.

**Types.** `readMutationScore` rend un nombre **ou** la chaîne `'UNKNOWN'`, la même valeur littérale que `computeVerdict` (Plan 2) traite déjà comme non évaluée et que `visual-cli.mjs` (Plan 3) émet — les trois chemins convergent sans conversion. `ALWAYS_ON` perd `runtime` en Task 1, ce dont dépendent les tests de la Task 1 et rien d'autre : `enabled` reste consommé uniquement par `computeVerdict`, qui itère dessus sans présupposer son contenu.
