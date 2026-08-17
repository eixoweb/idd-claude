# idd-claude — Plan 1 : Socle

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un plugin Claude Code installable qui promeut un schéma OpenSpec valide dans un projet cible, avec les skills portées de l'amont — sans encore aucun gate d'implémentation.

**Architecture:** Le repo est à la fois un plugin Claude Code (`.claude-plugin/` + `commands/` + `skills/` + `agents/`) et le porteur d'un schéma OpenSpec (`schema/`) que la commande `/idd:init` copie dans `<projet>/openspec/schemas/idd-claude/`. Toute la logique testable vit dans `scripts/lib/*.mjs`, importée par les scripts d'entrée et par les tests ; les commandes et skills restent des prompts Markdown, validés par des tests de conformité et un projet fixture.

**Tech Stack:** Node 22 (`node --test`, `node:assert/strict`), une seule dépendance de dev (`yaml`), OpenSpec ≥ 1.9.0, Superpowers ≥ 6.3.0.

**Spec:** `docs/superpowers/specs/2026-08-17-idd-claude-design.md`

## Global Constraints

- **OpenSpec ≥ 1.9.0** requis. La version installée localement est 1.2.0 — la Task 1 la met à jour. En 1.2.0 la commande `schema` est encore `[experimental]`.
- **Claude Code uniquement.** Aucun `.opencode/`, aucun `opencode.json` dans ce repo.
- **Langue** : tout le contenu du repo (commandes, skills, templates, README, messages d'erreur, messages de commit) est en **anglais**. Seuls les documents de conception sous `docs/superpowers/` restent en français.
- **Nommage** : plugin et schéma s'appellent tous deux `idd-claude` ; l'espace de commandes est `/idd:`.
- **Licence MIT.**
- **Node 22+**, tests avec le lanceur intégré (`node --test`). Une seule dépendance de dev autorisée dans ce plan : `yaml`.
- `verification.spec_as_source` et `verification.mutation` valent `false` par défaut dans toute config générée. Ce plan écrit ces clés ; ce qui les consomme (l'évaluateur) relève du Plan 2.

---

## Structure des fichiers


| Fichier                            | Responsabilité                                                           |
| ---------------------------------- | ------------------------------------------------------------------------ |
| `.claude-plugin/plugin.json`       | identité et version du plugin — la version pilote la détection de dérive |
| `.claude-plugin/marketplace.json`  | rend le repo installable par `/plugin marketplace add`                   |
| `schema/schema.yaml`               | le graphe d'artefacts OpenSpec                                           |
| `schema/templates/*.md`            | un gabarit par artefact                                                  |
| `schema/README.md`                 | comment activer le schéma                                                |
| `scripts/lib/openspec-version.mjs` | détection et comparaison de version d'OpenSpec                           |
| `scripts/lib/promote-schema.mjs`   | copie du schéma, écriture de config.yaml, détection de dérive            |
| `scripts/lib/frontmatter.mjs`      | extraction du frontmatter d'un SKILL.md                                  |
| `scripts/promote.mjs`              | point d'entrée CLI appelé par `/idd:init`                                |
| `commands/idd/init.md`             | le prompt de la commande                                                 |
| `skills/*/SKILL.md`                | les skills portées de l'amont                                            |
| `tests/*.test.mjs`                 | les tests                                                                |
| `tests/fixtures/js-toy/`           | projet fixture pour les tests de bout en bout                            |


`scripts/lib/` contient toute la logique ; `scripts/promote.mjs` ne fait que lire les arguments et afficher le résultat. C'est ce découpage qui rend le cœur testable sans lancer de processus.

---

### Task 1: Prérequis et squelette du plugin

**Files:**

- Create: `package.json`
- Create: `.claude-plugin/plugin.json`
- Create: `.claude-plugin/marketplace.json`
- Create: `.gitignore`
- Create: `LICENSE`
- Create: `README.md`
- Test: `tests/plugin-manifest.test.mjs`

**Interfaces:**

- Consumes: rien
- Produces: `plugin.json.version` (chaîne semver) que la Task 4 lit pour estampiller le schéma promu ; le script npm `test` que toutes les tâches suivantes utilisent.

- [ ] **Step 1: Mettre à jour OpenSpec et vérifier**

```bash
npm install -g @fission-ai/openspec@latest
openspec --version
```

Attendu : `1.9.0` ou supérieur. Si la sortie affiche encore `1.2.0`, vérifier que le `openspec` résolu par le PATH est bien celui de npm (`which openspec`).

- [ ] **Step 2: Écrire le test qui échoue**

Créer `tests/plugin-manifest.test.mjs` :

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const readJson = (rel) => JSON.parse(readFileSync(new URL(rel, root), 'utf8'))

test('plugin.json declares a name and a semver version', () => {
  const plugin = readJson('.claude-plugin/plugin.json')
  assert.equal(plugin.name, 'idd-claude')
  assert.match(plugin.version, /^\d+\.\d+\.\d+$/)
  assert.ok(plugin.description.length > 0, 'description must not be empty')
})

test('marketplace.json lists the plugin at the repo root', () => {
  const market = readJson('.claude-plugin/marketplace.json')
  const entry = market.plugins.find((p) => p.name === 'idd-claude')
  assert.ok(entry, 'marketplace.json must list a plugin named idd-claude')
  assert.equal(entry.source, './')
})
```

- [ ] **Step 3: Lancer le test pour vérifier qu'il échoue**

```bash
node --test tests/
```

Attendu : ÉCHEC avec `ENOENT ... .claude-plugin/plugin.json` — les manifestes n'existent pas encore.

- [ ] **Step 4: Créer les manifestes et le package**

`package.json` :

```json
{
  "name": "idd-claude",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/"
  },
  "devDependencies": {
    "yaml": "^2.4.0"
  }
}
```

`.claude-plugin/plugin.json` :

```json
{
  "name": "idd-claude",
  "version": "0.1.0",
  "description": "OpenSpec workflow for Claude Code with enforced Superpowers TDD, a scored evaluator gate, and measured visual verification.",
  "author": { "name": "Matthieu Guirlinger" },
  "repository": "https://github.com/mguirlinger/idd-claude",
  "license": "MIT",
  "keywords": ["openspec", "superpowers", "tdd", "spec-driven", "code-review"]
}
```

`.claude-plugin/marketplace.json` :

```json
{
  "name": "idd-claude",
  "owner": { "name": "Matthieu Guirlinger" },
  "metadata": {
    "description": "OpenSpec workflow for Claude Code with enforced Superpowers TDD and a scored evaluator gate."
  },
  "plugins": [
    { "name": "idd-claude", "source": "./" }
  ]
}
```

`.gitignore` :

```
node_modules/
.DS_Store
tests/fixtures/**/openspec/
```

`LICENSE` : le texte MIT standard, année 2026, titulaire « Matthieu Guirlinger ».

`README.md` :

```markdown
# idd-claude

An OpenSpec workflow for Claude Code where the implementation phase is
*enforced* by Superpowers rather than suggested: mandatory TDD, a scored
evaluator subagent per task group, and measured visual verification.

Forked from [intent-driven-template](https://github.com/intent-driven-dev/intent-driven-template),
which targets OpenCode.

## Prerequisites

| Requirement | Install |
|---|---|
| OpenSpec ≥ 1.9.0 | `npm install -g @fission-ai/openspec@latest` |
| Superpowers | `/plugin install superpowers@claude-plugins-official` |

## Install

```

/plugin marketplace add /idd-claude
/plugin install idd-claude@idd-claude

```

Then, from the root of a project you want to use it in:

```

/idd:init

```

This copies the schema into `openspec/schemas/idd-claude/` and writes
`openspec/config.yaml`. Re-run it after every plugin update — the commands
warn you when the promoted schema and the plugin have drifted apart.

## Design

See `docs/superpowers/specs/` for the design documents and
`docs/superpowers/plans/` for the implementation plans.
```

- [ ] **Step 5: Installer les dépendances et lancer les tests**

```bash
npm install
node --test tests/
```

Attendu : les 2 tests passent.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .claude-plugin/ .gitignore LICENSE README.md tests/
git commit -m "feat: plugin manifests and test harness"
```

---

### Task 2: Le schéma OpenSpec

**Files:**

- Create: `schema/schema.yaml`
- Create: `schema/templates/proposal.md`, `spec.md`, `design.md`, `adr.md`, `tasks.md`, `verification.md`
- Create: `schema/README.md`
- Test: `tests/schema-graph.test.mjs`

**Interfaces:**

- Consumes: rien
- Produces: le fichier `schema/schema.yaml` avec `name: idd-claude`, et six artefacts d'`id` `proposal`, `specs`, `design`, `adr`, `tasks`, `verification`. La Task 4 copie tout le dossier `schema/` ; la Task 5 valide le résultat avec `openspec validate`.

**Note de conception.** L'artefact `verification` dépend de `tasks`, pas de `apply` : `apply` est un bloc de premier niveau du schéma, pas un artefact, et rien ne garantit qu'un artefact puisse le référencer. Le fait que l'implémentation soit terminée est vérifié par la commande `/idd:verify` (toutes les cases de `tasks.md` cochées), pas par le graphe.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `tests/schema-graph.test.mjs` :

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { parse } from 'yaml'

const root = new URL('../', import.meta.url)
const schema = parse(readFileSync(new URL('schema/schema.yaml', root), 'utf8'))
const byId = Object.fromEntries(schema.artifacts.map((a) => [a.id, a]))

test('schema is named idd-claude', () => {
  assert.equal(schema.name, 'idd-claude')
})

test('the artifact set is exactly the six designed artifacts', () => {
  assert.deepEqual(
    Object.keys(byId).sort(),
    ['adr', 'design', 'proposal', 'specs', 'tasks', 'verification'],
  )
})

test('the dependency graph matches the design', () => {
  assert.deepEqual(byId.proposal.requires ?? [], [])
  assert.deepEqual(byId.specs.requires, ['proposal'])
  assert.deepEqual(byId.design.requires, ['proposal'])
  assert.deepEqual(byId.adr.requires, ['design'])
  assert.deepEqual([...byId.tasks.requires].sort(), ['adr', 'specs'])
  assert.deepEqual(byId.verification.requires, ['tasks'])
  assert.deepEqual(schema.apply.requires, ['tasks'])
})

test('no artifact depends on an unknown id', () => {
  for (const artifact of schema.artifacts) {
    for (const dep of artifact.requires ?? []) {
      assert.ok(byId[dep], `${artifact.id} requires unknown artifact "${dep}"`)
    }
  }
})

test('every artifact points at a template file that exists', () => {
  for (const artifact of schema.artifacts) {
    assert.ok(artifact.template, `${artifact.id} has no template`)
    const path = new URL(`schema/templates/${artifact.template}`, root)
    assert.ok(existsSync(path), `missing template for ${artifact.id}: ${artifact.template}`)
  }
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

```bash
node --test tests/schema-graph.test.mjs
```

Attendu : ÉCHEC avec `ENOENT ... schema/schema.yaml`.

- [ ] **Step 3: Écrire le schéma**

Partir du `schema.yaml` amont (`openspec/schemas/intent-driven/schema.yaml` du repo intent-driven-template), qui a déjà les cinq premiers artefacts avec leurs instructions rédigées. Trois modifications :

1. `name: idd-claude` et `description: Intent-driven OpenSpec workflow for Claude Code - proposal -> specs -> design -> adr -> tasks -> verification`.
2. Ajouter un sixième artefact :

```yaml
  - id: verification
    generates: verification.md
    description: Evaluator verdict and iteration log for the change
    template: verification.md
    requires:
      - tasks
    instruction: >
      Record the evaluator verdict for each task group.


      One entry per group and per attempt: the dimension scores, the floors in
      force, the verdict, and the findings that produced it. A group is only
      recorded once its verdict is PASS or once the iteration cap is reached.


      Never write this file by hand during implementation - it is produced by
      the evaluator subagent.
```

1. Laisser le bloc `apply` de l'amont **inchangé** pour l'instant. Les gates durs le remplacent au Plan 2 ; le remplacer ici sortirait du périmètre de cette tâche et rendrait son test non pertinent.

Les gabarits `templates/proposal.md`, `spec.md`, `design.md`, `adr.md`, `tasks.md` sont repris tels quels de l'amont. Créer `templates/verification.md` :

```markdown
# Verification Report

**Change**: `<change-name>`
**Schema**: idd-claude

## Group <N>

| Attempt | spec | runtime | visual | code | acceptance | Verdict |
|---|---|---|---|---|---|---|
| 1 | — | — | — | — | — | — |

**Floors in force**: `<copied from openspec/config.yaml>`

**Findings**

- <dimension>: <finding>

**Generated fix tasks**

- <N>.F1 FIX — <actionable fix>

## Outcome

- [ ] PASS — every group met its floors
- [ ] BLOCKED — infrastructure could not be evaluated
- [ ] STOPPED — iteration cap reached
```

`schema/README.md` : nom du schéma, la ligne `schema: idd-claude` à mettre dans `openspec/config.yaml`, le graphe d'artefacts, et un renvoi vers la spec de conception.

- [ ] **Step 4: Lancer les tests**

```bash
node --test tests/
```

Attendu : les 7 tests passent.

- [ ] **Step 5: Commit**

```bash
git add schema/ tests/schema-graph.test.mjs
git commit -m "feat: idd-claude OpenSpec schema with verification artifact"
```

---

### Task 3: Détection de version d'OpenSpec

**Files:**

- Create: `scripts/lib/openspec-version.mjs`
- Test: `tests/openspec-version.test.mjs`

**Interfaces:**

- Consumes: rien
- Produces: `MINIMUM_OPENSPEC` (chaîne `'1.9.0'`), `parseVersion(output: string) => {major, minor, patch} | null`, `isAtLeast(version: string, minimum: string) => boolean`, `detectOpenspec(run?: () => string) => {installed: boolean, version: string | null, satisfies: boolean}`. La Task 5 appelle `detectOpenspec()`.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `tests/openspec-version.test.mjs` :

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MINIMUM_OPENSPEC,
  parseVersion,
  isAtLeast,
  detectOpenspec,
} from '../scripts/lib/openspec-version.mjs'

test('parseVersion extracts the triple from CLI output', () => {
  assert.deepEqual(parseVersion('1.2.0'), { major: 1, minor: 2, patch: 0 })
  assert.deepEqual(parseVersion('1.9.0\n'), { major: 1, minor: 9, patch: 0 })
  assert.equal(parseVersion('not a version'), null)
})

test('isAtLeast compares numerically, not lexically', () => {
  // 1.10.0 sorts before 1.9.0 as a string — it must still count as newer.
  assert.equal(isAtLeast('1.10.0', '1.9.0'), true)
  assert.equal(isAtLeast('1.9.0', '1.9.0'), true)
  assert.equal(isAtLeast('1.9.1', '1.9.0'), true)
  assert.equal(isAtLeast('1.2.0', '1.9.0'), false)
  assert.equal(isAtLeast('2.0.0', '1.9.0'), true)
  assert.equal(isAtLeast('0.9.0', '1.9.0'), false)
})

test('the minimum is 1.9.0', () => {
  assert.equal(MINIMUM_OPENSPEC, '1.9.0')
})

test('detectOpenspec reports a satisfied install', () => {
  const result = detectOpenspec(() => '1.9.0\n')
  assert.deepEqual(result, { installed: true, version: '1.9.0', satisfies: true })
})

test('detectOpenspec reports an install that is too old', () => {
  const result = detectOpenspec(() => '1.2.0\n')
  assert.deepEqual(result, { installed: true, version: '1.2.0', satisfies: false })
})

test('detectOpenspec reports a missing binary instead of throwing', () => {
  const result = detectOpenspec(() => {
    throw new Error('spawn openspec ENOENT')
  })
  assert.deepEqual(result, { installed: false, version: null, satisfies: false })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

```bash
node --test tests/openspec-version.test.mjs
```

Attendu : ÉCHEC — `Cannot find module ... scripts/lib/openspec-version.mjs`.

- [ ] **Step 3: Écrire l'implémentation minimale**

Créer `scripts/lib/openspec-version.mjs` :

```javascript
import { execFileSync } from 'node:child_process'

export const MINIMUM_OPENSPEC = '1.9.0'

export function parseVersion(output) {
  const match = String(output).trim().match(/(\d+)\.(\d+)\.(\d+)/)
  if (!match) return null
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) }
}

export function isAtLeast(version, minimum) {
  const a = parseVersion(version)
  const b = parseVersion(minimum)
  if (!a || !b) return false
  if (a.major !== b.major) return a.major > b.major
  if (a.minor !== b.minor) return a.minor > b.minor
  return a.patch >= b.patch
}

const defaultRun = () => execFileSync('openspec', ['--version'], { encoding: 'utf8' })

export function detectOpenspec(run = defaultRun) {
  let raw
  try {
    raw = run()
  } catch {
    return { installed: false, version: null, satisfies: false }
  }
  const parsed = parseVersion(raw)
  if (!parsed) return { installed: true, version: null, satisfies: false }
  const version = `${parsed.major}.${parsed.minor}.${parsed.patch}`
  return { installed: true, version, satisfies: isAtLeast(version, MINIMUM_OPENSPEC) }
}
```

- [ ] **Step 4: Lancer les tests**

```bash
node --test tests/
```

Attendu : les 6 nouveaux tests passent, les précédents aussi.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/openspec-version.mjs tests/openspec-version.test.mjs
git commit -m "feat: detect and compare the installed OpenSpec version"
```

---

### Task 4: Promotion du schéma

**Files:**

- Create: `scripts/lib/promote-schema.mjs`
- Test: `tests/promote-schema.test.mjs`

**Interfaces:**

- Consumes: `plugin.json.version` (Task 1), le dossier `schema/` (Task 2)
- Produces: `SCHEMA_NAME` (chaîne `'idd-claude'`), `defaultConfig() => string`, `promoteSchema({pluginRoot, projectRoot, pluginVersion}) => {schemaPath, configPath, configCreated}`, `promotedVersion(projectRoot) => string | null`, `hasDrifted(projectRoot, pluginVersion) => boolean`. La Task 5 appelle `promoteSchema` et `hasDrifted`.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `tests/promote-schema.test.mjs` :

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import {
  SCHEMA_NAME,
  defaultConfig,
  promoteSchema,
  promotedVersion,
  hasDrifted,
} from '../scripts/lib/promote-schema.mjs'

const pluginRoot = fileURLToPath(new URL('../', import.meta.url))
const newProject = () => mkdtempSync(join(tmpdir(), 'idd-'))

test('promoteSchema copies the schema into the project', () => {
  const project = newProject()
  const { schemaPath } = promoteSchema({ pluginRoot, projectRoot: project, pluginVersion: '0.1.0' })
  assert.equal(schemaPath, join(project, 'openspec', 'schemas', SCHEMA_NAME))
  assert.ok(existsSync(join(schemaPath, 'schema.yaml')))
  assert.ok(existsSync(join(schemaPath, 'templates', 'proposal.md')))
})

test('promoteSchema writes a default config when none exists', () => {
  const project = newProject()
  const { configCreated, configPath } = promoteSchema({
    pluginRoot, projectRoot: project, pluginVersion: '0.1.0',
  })
  assert.equal(configCreated, true)
  const config = parse(readFileSync(configPath, 'utf8'))
  assert.equal(config.schema, SCHEMA_NAME)
  assert.equal(config.verification.spec_as_source, false)
  assert.equal(config.verification.visual, true)
  assert.equal(config.verification.mutation, false)
  assert.equal(config.verification.floors.runtime, 100)
  assert.equal(config.verification.floors.visual, 100)
  assert.equal(config.verification.floors.mutation, 70)
  assert.equal(config.verification.max_iterations, 5)
})

test('promoteSchema never overwrites an existing config', () => {
  const project = newProject()
  mkdirSync(join(project, 'openspec'), { recursive: true })
  const configPath = join(project, 'openspec', 'config.yaml')
  writeFileSync(configPath, 'schema: idd-claude\nverification:\n  visual: false\n', 'utf8')

  const result = promoteSchema({ pluginRoot, projectRoot: project, pluginVersion: '0.1.0' })

  assert.equal(result.configCreated, false)
  assert.equal(parse(readFileSync(configPath, 'utf8')).verification.visual, false)
})

test('promoteSchema stamps the plugin version it came from', () => {
  const project = newProject()
  promoteSchema({ pluginRoot, projectRoot: project, pluginVersion: '0.1.0' })
  assert.equal(promotedVersion(project), '0.1.0')
})

test('hasDrifted is true only when a promoted version differs', () => {
  const project = newProject()
  assert.equal(hasDrifted(project, '0.1.0'), false, 'never promoted is not drift')
  promoteSchema({ pluginRoot, projectRoot: project, pluginVersion: '0.1.0' })
  assert.equal(hasDrifted(project, '0.1.0'), false)
  assert.equal(hasDrifted(project, '0.2.0'), true)
})

test('defaultConfig is parseable YAML with spec_as_source off', () => {
  const config = parse(defaultConfig())
  assert.equal(config.verification.spec_as_source, false)
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

```bash
node --test tests/promote-schema.test.mjs
```

Attendu : ÉCHEC — `Cannot find module ... scripts/lib/promote-schema.mjs`.

- [ ] **Step 3: Écrire l'implémentation minimale**

Créer `scripts/lib/promote-schema.mjs` :

```javascript
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const SCHEMA_NAME = 'idd-claude'

const VERSION_STAMP = '.promoted-version'

export function defaultConfig() {
  return `schema: ${SCHEMA_NAME}
stack: javascript              # javascript | php (v2)

verification:
  spec_as_source: false        # executable Gherkin - off by default
  visual: true                 # dev-browser gate
  mutation: false              # mutation testing - off by default
  subagents: true              # one subagent per task
  floors:                      # a dimension below its floor -> RETRY
    spec: 80
    runtime: 100
    visual: 100
    code: 60
    mutation: 70
    acceptance: 100
  max_iterations: 5
  evaluator_model: sonnet

project:
  dev_stack_command: ""
  test_commands: []

rules: {}
`
}

export function promoteSchema({ pluginRoot, projectRoot, pluginVersion }) {
  const schemaPath = join(projectRoot, 'openspec', 'schemas', SCHEMA_NAME)
  mkdirSync(schemaPath, { recursive: true })
  cpSync(join(pluginRoot, 'schema'), schemaPath, { recursive: true })
  writeFileSync(join(schemaPath, VERSION_STAMP), `${pluginVersion}\n`, 'utf8')

  const configPath = join(projectRoot, 'openspec', 'config.yaml')
  const configCreated = !existsSync(configPath)
  if (configCreated) writeFileSync(configPath, defaultConfig(), 'utf8')

  return { schemaPath, configPath, configCreated }
}

export function promotedVersion(projectRoot) {
  const stamp = join(projectRoot, 'openspec', 'schemas', SCHEMA_NAME, VERSION_STAMP)
  return existsSync(stamp) ? readFileSync(stamp, 'utf8').trim() : null
}

export function hasDrifted(projectRoot, pluginVersion) {
  const promoted = promotedVersion(projectRoot)
  return promoted !== null && promoted !== pluginVersion
}
```

- [ ] **Step 4: Lancer les tests**

```bash
node --test tests/
```

Attendu : les 6 nouveaux tests passent.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/promote-schema.mjs tests/promote-schema.test.mjs
git commit -m "feat: promote the schema into a target project with drift stamping"
```

---

### Task 5: Le point d'entrée et la commande /idd:init

**Files:**

- Create: `scripts/promote.mjs`
- Create: `commands/idd/init.md`
- Create: `tests/fixtures/js-toy/package.json`
- Test: `tests/init-end-to-end.test.mjs`

**Interfaces:**

- Consumes: `detectOpenspec` (Task 3), `promoteSchema` / `hasDrifted` / `SCHEMA_NAME` (Task 4), `plugin.json.version` (Task 1)
- Produces: le binaire `node scripts/promote.mjs <projectRoot>`, qui sort en code 0 en cas de succès et en code 1 avec un message sur stderr si OpenSpec est absent ou trop ancien.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `tests/fixtures/js-toy/package.json` :

```json
{ "name": "js-toy", "version": "0.0.0", "private": true, "type": "module" }
```

Créer `tests/init-end-to-end.test.mjs` :

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const pluginRoot = fileURLToPath(new URL('../', import.meta.url))
const fixture = join(pluginRoot, 'tests', 'fixtures', 'js-toy')
const promote = join(pluginRoot, 'scripts', 'promote.mjs')

const freshProject = () => {
  const dir = mkdtempSync(join(tmpdir(), 'idd-e2e-'))
  cpSync(fixture, dir, { recursive: true })
  return dir
}

test('promote.mjs installs a schema that OpenSpec accepts', () => {
  const project = freshProject()

  execFileSync('node', [promote, project], { encoding: 'utf8' })

  assert.ok(existsSync(join(project, 'openspec', 'schemas', 'idd-claude', 'schema.yaml')))
  assert.ok(existsSync(join(project, 'openspec', 'config.yaml')))

  const schemas = execFileSync('openspec', ['schemas', '--json'], {
    cwd: project,
    encoding: 'utf8',
  })
  assert.match(schemas, /idd-claude/)
})

test('promote.mjs refuses to run when OpenSpec is too old', () => {
  const project = freshProject()
  let error
  try {
    execFileSync('node', [promote, project], {
      encoding: 'utf8',
      env: { ...process.env, IDD_FAKE_OPENSPEC_VERSION: '1.2.0' },
      stdio: 'pipe',
    })
  } catch (caught) {
    error = caught
  }

  // Assert on the captured stderr rather than on error.message: execFileSync
  // does not reliably fold the child's stderr into the message.
  assert.ok(error, 'promote.mjs must exit non-zero')
  assert.equal(error.status, 1)
  assert.match(error.stderr, /1\.9\.0/, 'the error must name the required minimum version')
  assert.equal(
    existsSync(join(project, 'openspec', 'config.yaml')),
    false,
    'nothing must be written when the prerequisite check fails',
  )
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

```bash
node --test tests/init-end-to-end.test.mjs
```

Attendu : ÉCHEC — `Cannot find module ... scripts/promote.mjs`.

- [ ] **Step 3: Écrire le point d'entrée**

Créer `scripts/promote.mjs` :

```javascript
#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { detectOpenspec, MINIMUM_OPENSPEC } from './lib/openspec-version.mjs'
import { promoteSchema, hasDrifted } from './lib/promote-schema.mjs'

const pluginRoot = fileURLToPath(new URL('../', import.meta.url))
const projectRoot = resolve(process.argv[2] ?? process.cwd())
const pluginVersion = JSON.parse(
  readFileSync(new URL('../.claude-plugin/plugin.json', import.meta.url), 'utf8'),
).version

// The fake version lets the end-to-end test exercise the refusal path without
// downgrading the real CLI.
const fake = process.env.IDD_FAKE_OPENSPEC_VERSION
const openspec = detectOpenspec(fake ? () => fake : undefined)

if (!openspec.installed) {
  console.error('OpenSpec is not installed. Run: npm install -g @fission-ai/openspec@latest')
  process.exit(1)
}
if (!openspec.satisfies) {
  console.error(
    `OpenSpec ${openspec.version ?? 'unknown'} is too old — ${MINIMUM_OPENSPEC} or newer is required.\n` +
      'Run: npm install -g @fission-ai/openspec@latest',
  )
  process.exit(1)
}

const drifted = hasDrifted(projectRoot, pluginVersion)
const { schemaPath, configPath, configCreated } = promoteSchema({
  pluginRoot,
  projectRoot,
  pluginVersion,
})

console.log(`Schema promoted to ${schemaPath} (plugin ${pluginVersion})`)
console.log(configCreated ? `Config written to ${configPath}` : `Config left untouched at ${configPath}`)
if (drifted) console.log('The previously promoted schema was from a different plugin version — it has been refreshed.')
```

- [ ] **Step 4: Écrire la commande**

Créer `commands/idd/init.md` :

```markdown
---
name: "IDD: Init"
description: "Install the idd-claude OpenSpec schema into this project and write its config"
---

Set up this project for the idd-claude workflow.

1. Run the promotion script from the repository root:

   `node "${CLAUDE_PLUGIN_ROOT}/scripts/promote.mjs" .`

   If it exits non-zero, report its message verbatim and stop. Do not attempt
   to install or upgrade OpenSpec yourself — tell the user the command to run.

2. Read `openspec/config.yaml`. If `project.dev_stack_command` or
   `project.test_commands` are empty, ask the user for them one at a time and
   fill them in. These are required before `/idd:apply` can score the runtime
   and visual dimensions.

3. Confirm `openspec schemas` lists `idd-claude`, then report:
   - where the schema was installed,
   - whether the config was created or left untouched,
   - that `verification.spec_as_source` is off by default and how to enable it.

Never edit files under `openspec/schemas/idd-claude/` in a target project:
they are a copy, and the next promotion overwrites them.
```

- [ ] **Step 5: Lancer les tests**

```bash
node --test tests/
```

Attendu : tous les tests passent, dont les 2 nouveaux. Le second exige qu'`openspec` soit dans le PATH en version ≥ 1.9.0 — c'est ce qu'a installé la Task 1.

- [ ] **Step 6: Commit**

```bash
git add scripts/promote.mjs commands/ tests/fixtures/ tests/init-end-to-end.test.mjs
git commit -m "feat: /idd:init command and schema promotion entry point"
```

---

### Task 6: Port des skills et agents amont

**Files:**

- Create: `skills/spec-as-source/`, `skills/gherkin-authoring/`, `skills/acceptance-test-authoring/`, `skills/architectural-decision-records/`, `skills/glossary/`, `skills/grill-me/`, `skills/adversarial-authoring/`, `skills/openspec-git-discipline/`, `skills/c4-diagrams/`
- Create: `agents/adversarial-author.md`, `agents/adversarial-reviewer.md`
- Create: `skills-lock.json`
- Create: `scripts/lib/frontmatter.mjs`
- Test: `tests/skills-conformance.test.mjs`

Les deux agents sont portés dans la même tâche que la skill `adversarial-authoring` : elle les invoque, donc la livrer sans eux produirait une skill cassée.

**Interfaces:**

- Consumes: rien
- Produces: `parseFrontmatter(source: string) => object | null`, exporté par `scripts/lib/frontmatter.mjs`. Les Plans 2 et 3 ajoutent des skills dans `skills/` et héritent de ce test de conformité.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `tests/skills-conformance.test.mjs` :

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseFrontmatter } from '../scripts/lib/frontmatter.mjs'

const skillsRoot = fileURLToPath(new URL('../skills/', import.meta.url))
const skillDirs = readdirSync(skillsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)

const EXPECTED = [
  'acceptance-test-authoring',
  'adversarial-authoring',
  'architectural-decision-records',
  'c4-diagrams',
  'gherkin-authoring',
  'glossary',
  'grill-me',
  'openspec-git-discipline',
  'spec-as-source',
]

test('every ported skill is present', () => {
  for (const name of EXPECTED) {
    assert.ok(skillDirs.includes(name), `missing skill: ${name}`)
  }
})

test('every skill has frontmatter whose name matches its directory', () => {
  for (const dir of skillDirs) {
    const file = join(skillsRoot, dir, 'SKILL.md')
    assert.ok(existsSync(file), `${dir} has no SKILL.md`)
    const frontmatter = parseFrontmatter(readFileSync(file, 'utf8'))
    assert.ok(frontmatter, `${dir}: SKILL.md has no frontmatter block`)
    assert.equal(frontmatter.name, dir, `${dir}: frontmatter name must match the directory`)
    assert.ok(
      typeof frontmatter.description === 'string' && frontmatter.description.length > 0,
      `${dir}: description must be a non-empty string`,
    )
  }
})

test('no skill references an OpenCode path', () => {
  for (const dir of skillDirs) {
    const source = readFileSync(join(skillsRoot, dir, 'SKILL.md'), 'utf8')
    assert.doesNotMatch(source, /\.opencode\//, `${dir}: still references .opencode/`)
    assert.doesNotMatch(source, /\.agents\/skills\//, `${dir}: still references .agents/skills/`)
  }
})

const agentsRoot = fileURLToPath(new URL('../agents/', import.meta.url))

test('the adversarial agents are ported with Claude Code frontmatter', () => {
  for (const file of ['adversarial-author.md', 'adversarial-reviewer.md']) {
    const path = join(agentsRoot, file)
    assert.ok(existsSync(path), `missing agent: ${file}`)
    const frontmatter = parseFrontmatter(readFileSync(path, 'utf8'))
    assert.ok(frontmatter, `${file}: no frontmatter block`)
    assert.equal(frontmatter.name, file.replace(/\.md$/, ''))
    assert.ok(frontmatter.description?.length > 0, `${file}: description must not be empty`)
    // OpenCode routes to other vendors; Claude Code only accepts these tiers.
    assert.ok(
      ['haiku', 'sonnet', 'opus'].includes(frontmatter.model),
      `${file}: model must be a Claude Code tier, got "${frontmatter.model}"`,
    )
    assert.equal(frontmatter.mode, undefined, `${file}: "mode" is OpenCode-only, drop it`)
  }
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

```bash
node --test tests/skills-conformance.test.mjs
```

Attendu : ÉCHEC — `Cannot find module ... scripts/lib/frontmatter.mjs`.

- [ ] **Step 3: Écrire le parseur de frontmatter**

Créer `scripts/lib/frontmatter.mjs` :

```javascript
import { parse } from 'yaml'

const DELIMITED = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/

export function parseFrontmatter(source) {
  const match = String(source).match(DELIMITED)
  if (!match) return null
  const parsed = parse(match[1])
  return parsed && typeof parsed === 'object' ? parsed : null
}
```

- [ ] **Step 4: Copier les skills depuis l'amont**

Cloner l'amont dans un répertoire temporaire et copier les neuf dossiers :

```bash
git clone --depth 1 https://github.com/intent-driven-dev/intent-driven-template.git /tmp/idt-src
mkdir -p skills
cp -R /tmp/idt-src/.agents/skills/* skills/
cp /tmp/idt-src/skills-lock.json skills-lock.json
cp -R /tmp/idt-src/.opencode/skills/adversarial-authoring skills/adversarial-authoring
```

Puis, dans chaque `SKILL.md` copié, remplacer les chemins propres à OpenCode :

- `.agents/skills/<nom>/` devient `skills/<nom>/`
- `.opencode/skills/<nom>/` devient `skills/<nom>/`

Le test de l'étape 1 échoue tant qu'il reste une occurrence, ce qui rend la relecture inutile : lancer le test suffit à trouver les oublis.

- [ ] **Step 4b: Porter les deux agents adversariaux**

```bash
mkdir -p agents
cp /tmp/idt-src/.opencode/agent/adversarial-author.md agents/
cp /tmp/idt-src/.opencode/agent/adversarial-reviewer.md agents/
```

Le **corps** des deux fichiers est conservé tel quel — c'est le prompt, et il est bon. Seul le frontmatter change, parce que celui de l'amont est propre à OpenCode (`mode: subagent`, modèles d'autres fournisseurs, bloc `permission`). Remplacer celui de `agents/adversarial-author.md` par :

```yaml
---
name: adversarial-author
description: Produces a strong first draft of an artifact for the adversarial-authoring workflow. Dispatched by the adversarial-authoring skill, never invoked directly.
model: opus
---
```

Et celui de `agents/adversarial-reviewer.md` par :

```yaml
---
name: adversarial-reviewer
description: Challenges an adversarial-authoring draft before the primary agent writes the final artifact. Dispatched by the adversarial-authoring skill, never invoked directly.
model: opus
---
```

**Perte assumée, à noter dans le corps du fichier du relecteur** : l'amont fait tourner l'auteur et le relecteur sur des familles de modèles différentes (`opencode/big-pickle` contre `openai/gpt-5.5`), ce qui garantit qu'un modèle ne s'auto-approuve pas. Claude Code ne route que vers des modèles Anthropic. Ajouter en tête du corps du relecteur une phrase le disant, pour que la limite soit connue de qui lit l'agent :

```markdown
> Note: upstream ran this reviewer on a different model family from the author,
> so the draft was challenged from genuinely outside. Claude Code routes to a
> single vendor, so this is a second pass rather than a second perspective.
> Weigh its verdicts accordingly.
```

- [ ] **Step 5: Lancer les tests**

```bash
node --test tests/
```

Attendu : les 4 nouveaux tests passent. Si le test de conformité signale un `name` de frontmatter qui ne correspond pas à son dossier, renommer le dossier plutôt que le frontmatter — c'est le frontmatter qui est référencé par les autres skills.

- [ ] **Step 6: Commit**

```bash
git add skills/ agents/ skills-lock.json scripts/lib/frontmatter.mjs tests/skills-conformance.test.mjs
git commit -m "feat: port upstream skills and adversarial agents to the Claude Code layout"
```

---

## Auto-relecture

**Couverture de la spec.** Ce plan couvre la structure du repo, le pipeline d'artefacts (schéma + artefact `verification`), la configuration par défaut avec ses planchers, et la détection de dérive de version. Les sections de la spec **non couvertes ici et renvoyées aux plans suivants**, par construction : le typage des tâches et ce qui force le TDD (Plan 2), la couche multi-agent (Plan 2), l'évaluateur (Plan 2), le gate visuel (Plan 3), l'extracteur Gherkin et le pack d'acceptation (Plan 4). Le bloc `apply` du schéma reste volontairement celui de l'amont à l'issue de ce plan — c'est le Plan 2 qui le remplace.

**Dégradations.** Deux des six lignes du tableau des dégradations sont implémentées ici : OpenSpec absent ou trop ancien (Task 5), dérive de version du schéma (Tasks 4 et 5). Les quatre autres dépendent d'`apply` et relèvent du Plan 2.

**Types.** `SCHEMA_NAME` est défini dans `promote-schema.mjs` et utilisé par `promote.mjs` et les tests. `parseFrontmatter` est défini en Task 6 et consommé par son propre test uniquement dans ce plan. `detectOpenspec` accepte un `run` injectable, ce dont dépend le test de refus de la Task 5 via `IDD_FAKE_OPENSPEC_VERSION`.