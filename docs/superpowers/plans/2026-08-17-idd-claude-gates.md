# idd-claude — Plan 2 : Gates d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre la phase d'implémentation contrainte — TDD non contournable, sous-agent évaluateur scoré par groupe de tâches, verdict par planchers — et livrer le chemin *bounded* utilisable de bout en bout.

**Architecture:** Toute la logique de décision est du code pur dans `scripts/lib/` (lecture de config, parseur de `tasks.md`, calcul du verdict), testée en TDD et importée par les prompts via des commandes shell. Les prompts (`agents/evaluator.md`, `commands/idd/*.md`) ne portent que l'orchestration, et sont validés par des tests structurels qui encodent les règles de conception plutôt que par des exécutions coûteuses.

**Tech Stack:** Node 22 (`node --test`), `yaml`, OpenSpec ≥ 1.9.0, Superpowers ≥ 6.3.0.

**Spec:** `docs/superpowers/specs/2026-08-17-idd-claude-design.md`

## Global Constraints

- Reprend toutes les contraintes du Plan 1 (anglais dans le repo, MIT, `node --test`, OpenSpec ≥ 1.9.0).
- **Deux schémas** : `idd-claude` (architectural) et `idd-claude-lite` (bounded). Le choix se fait **par changement** via `openspec new change <id> --schema <nom>`, jamais en réécrivant `config.yaml`.
- **Six dimensions** d'évaluation : `spec`, `runtime`, `code` toujours actives ; `visual`, `mutation`, `acceptance` conditionnées par la config.
- **Verdict par planchers**, jamais par moyenne pondérée. Une dimension sous son plancher suffit à rendre `RETRY`.
- Une dimension activée mais **non évaluable** rend `BLOCK` (infrastructure), jamais `RETRY` (code). Un `PASS` obtenu en sautant une dimension est un mensonge.
- `requesting-code-review` n'est **jamais** invoquée directement pendant apply — seul l'évaluateur l'appelle, en interne.

---

## Structure des fichiers

| Fichier | Responsabilité |
| --- | --- |
| `schema-lite/schema.yaml` | le graphe allégé : proposal → specs → tasks → apply → verification |
| `scripts/lib/config.mjs` | lecture et validation du bloc `verification` de `config.yaml` |
| `scripts/lib/tasks.mjs` | parseur de `tasks.md` en groupes et tâches typées |
| `scripts/lib/verdict.mjs` | calcul du verdict à partir des scores, planchers et dimensions actives |
| `agents/evaluator.md` | le sous-agent évaluateur |
| `commands/idd/apply.md` | la boucle d'implémentation et ses gates |
| `commands/idd/propose.md` | garde de niveau et choix du schéma |
| `commands/idd/verify.md`, `archive.md` | clôture |

`config.mjs`, `tasks.mjs` et `verdict.mjs` ne dépendent d'aucun processus externe : ce sont des fonctions pures sur des chaînes et des objets, ce qui les rend testables sans fixture.

---

### Task 1: Le schéma allégé et la promotion des deux schémas

**Files:**
- Create: `schema-lite/schema.yaml`, `schema-lite/README.md`
- Create: `schema-lite/templates/` (liens vers les mêmes gabarits que `schema/`, copiés)
- Modify: `scripts/lib/promote-schema.mjs`
- Test: `tests/schema-lite-graph.test.mjs`, `tests/promote-schema.test.mjs`

**Interfaces:**
- Consumes: `promoteSchema` (Plan 1)
- Produces: `SCHEMA_NAMES` (tableau `['idd-claude', 'idd-claude-lite']`) exporté par `promote-schema.mjs` ; `promoteSchema` retourne désormais `{schemaPaths: {[name]: path}, configPath, configCreated}`.

- [ ] **Step 1: Écrire le test du graphe allégé**

Créer `tests/schema-lite-graph.test.mjs` :

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { parse } from 'yaml'

const root = new URL('../', import.meta.url)
const schema = parse(readFileSync(new URL('schema-lite/schema.yaml', root), 'utf8'))
const byId = Object.fromEntries(schema.artifacts.map((a) => [a.id, a]))

test('the lite schema is named idd-claude-lite', () => {
  assert.equal(schema.name, 'idd-claude-lite')
})

test('the lite schema drops design and adr', () => {
  assert.deepEqual(Object.keys(byId).sort(), ['proposal', 'specs', 'tasks', 'verification'])
})

test('the lite dependency graph is linear', () => {
  assert.deepEqual(byId.proposal.requires ?? [], [])
  assert.deepEqual(byId.specs.requires, ['proposal'])
  assert.deepEqual(byId.tasks.requires, ['specs'])
  assert.deepEqual(byId.verification.requires, ['tasks'])
  assert.deepEqual(schema.apply.requires, ['tasks'])
})

test('every lite artifact points at a template that exists', () => {
  for (const artifact of schema.artifacts) {
    assert.ok(artifact.template, `${artifact.id} has no template`)
    assert.ok(
      existsSync(new URL(`schema-lite/templates/${artifact.template}`, root)),
      `missing template for ${artifact.id}: ${artifact.template}`,
    )
  }
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

```bash
node --test
```

Attendu : ÉCHEC avec `ENOENT ... schema-lite/schema.yaml`.

- [ ] **Step 3: Écrire le schéma allégé**

```bash
mkdir -p schema-lite/templates
cp schema/templates/proposal.md schema/templates/spec.md schema/templates/tasks.md \
   schema/templates/verification.md schema-lite/templates/
```

Créer `schema-lite/schema.yaml` en reprenant de `schema/schema.yaml` les quatre artefacts `proposal`, `specs`, `tasks`, `verification` **avec leurs instructions inchangées**, en modifiant seulement :

- l'en-tête : `name: idd-claude-lite`, `description: Bounded-change OpenSpec workflow for Claude Code - proposal -> specs -> tasks -> verification` ;
- `tasks.requires` qui devient `[specs]` au lieu de `[specs, adr]` ;
- l'ajout, en tête de l'instruction de `proposal`, du paragraphe suivant :

```
      This is the bounded workflow: no design document, no ADR. If while
      writing this proposal it becomes clear that the change is cross-cutting,
      introduces a new external dependency, carries security or migration
      complexity, or needs an architectural decision recorded, stop and tell
      the user to recreate the change with the full schema:
      openspec new change <id> --schema idd-claude
```

Ce garde-fou compte : c'est le seul point où l'on peut rattraper un changement mal classé, avant que du code soit écrit.

`schema-lite/README.md` : nom, la commande de création (`openspec new change <id> --schema idd-claude-lite`), le graphe linéaire, et la phrase disant quand basculer sur le schéma complet.

- [ ] **Step 4: Écrire le test de promotion des deux schémas**

Dans `tests/promote-schema.test.mjs`, remplacer le premier test par :

```javascript
test('promoteSchema copies both schemas into the project', () => {
  const project = newProject()
  const { schemaPaths } = promoteSchema({ pluginRoot, projectRoot: project, pluginVersion: '0.1.0' })

  assert.deepEqual(Object.keys(schemaPaths).sort(), ['idd-claude', 'idd-claude-lite'])
  for (const [name, path] of Object.entries(schemaPaths)) {
    assert.equal(path, join(project, 'openspec', 'schemas', name))
    assert.ok(existsSync(join(path, 'schema.yaml')), `${name}: no schema.yaml`)
    assert.ok(existsSync(join(path, 'templates', 'proposal.md')), `${name}: no proposal template`)
  }
})

test('both promoted schemas are stamped with the plugin version', () => {
  const project = newProject()
  promoteSchema({ pluginRoot, projectRoot: project, pluginVersion: '0.1.0' })
  assert.equal(promotedVersion(project), '0.1.0')
  assert.equal(promotedVersion(project, 'idd-claude-lite'), '0.1.0')
})
```

- [ ] **Step 5: Adapter la promotion**

Dans `scripts/lib/promote-schema.mjs` :

```javascript
export const SCHEMA_NAME = 'idd-claude'
export const SCHEMA_NAMES = ['idd-claude', 'idd-claude-lite']

const SOURCE_DIRS = { 'idd-claude': 'schema', 'idd-claude-lite': 'schema-lite' }

export function promoteSchema({ pluginRoot, projectRoot, pluginVersion }) {
  const schemaPaths = {}
  for (const name of SCHEMA_NAMES) {
    const target = join(projectRoot, 'openspec', 'schemas', name)
    mkdirSync(target, { recursive: true })
    cpSync(join(pluginRoot, SOURCE_DIRS[name]), target, { recursive: true })
    writeFileSync(join(target, VERSION_STAMP), `${pluginVersion}\n`, 'utf8')
    schemaPaths[name] = target
  }

  const configPath = join(projectRoot, 'openspec', 'config.yaml')
  const configCreated = !existsSync(configPath)
  if (configCreated) writeFileSync(configPath, defaultConfig(), 'utf8')

  return { schemaPaths, configPath, configCreated }
}

export function promotedVersion(projectRoot, name = SCHEMA_NAME) {
  const stamp = join(projectRoot, 'openspec', 'schemas', name, VERSION_STAMP)
  return existsSync(stamp) ? readFileSync(stamp, 'utf8').trim() : null
}
```

Adapter `scripts/promote.mjs`, qui lit `schemaPath` au singulier :

```javascript
const { schemaPaths, configPath, configCreated } = promoteSchema({
  pluginRoot,
  projectRoot,
  pluginVersion,
})

for (const [name, path] of Object.entries(schemaPaths)) {
  console.log(`Schema ${name} promoted to ${path} (plugin ${pluginVersion})`)
}
```

- [ ] **Step 6: Basculer `visual` à `false` par défaut**

Le runner d'assertions dev-browser n'arrive qu'au Plan 3. Or `/idd:apply` (Task 6)
refusera de démarrer si une dimension activée est inévaluable — c'est la règle
« pas de dégradation silencieuse », et elle rendrait ce plan inutilisable si
`visual` restait à `true`.

Dans `scripts/lib/promote-schema.mjs`, `defaultConfig()` :

```
  visual: false                # dev-browser gate - enabled in plan 3
```

Et dans `tests/promote-schema.test.mjs`, corriger l'assertion correspondante :

```javascript
  assert.equal(config.verification.visual, false)
```

Le Plan 3 rebasculera cette valeur à `true` dans le même commit qui livre le
runner — jamais avant.

- [ ] **Step 7: Lancer les tests**

```bash
node --test
```

Attendu : tous verts. Le test de bout en bout du Plan 1 (`openspec schemas --json` contient `idd-claude`) continue de passer ; ajouter dans ce même test l'assertion que la sortie contient aussi `idd-claude-lite`.

- [ ] **Step 8: Commit**

```bash
git add schema-lite/ scripts/ tests/
git commit -m "feat: lite schema for bounded changes, promote both schemas"
```

---

### Task 2: Lecture et validation de la configuration

**Files:**
- Create: `scripts/lib/config.mjs`
- Test: `tests/config.test.mjs`

**Interfaces:**
- Consumes: rien
- Produces: `ALL_DIMENSIONS` (`['spec','runtime','code','visual','mutation','acceptance']`), `readVerification(configSource: string) => {enabled: string[], floors: object, maxIterations: number, evaluatorModel: string, subagents: boolean}`. Les Tasks 4 et 6 consomment `enabled` et `floors`.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `tests/config.test.mjs` :

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ALL_DIMENSIONS, readVerification } from '../scripts/lib/config.mjs'

const base = `
schema: idd-claude
verification:
  spec_as_source: false
  visual: true
  mutation: false
  subagents: true
  floors: { spec: 80, runtime: 100, visual: 100, code: 60, mutation: 70, acceptance: 100 }
  max_iterations: 5
  evaluator_model: sonnet
`

test('spec, runtime and code are always enabled', () => {
  const { enabled } = readVerification('verification: {}')
  assert.deepEqual(enabled.sort(), ['code', 'runtime', 'spec'])
})

test('visual, mutation and acceptance follow their flags', () => {
  const { enabled } = readVerification(base)
  assert.ok(enabled.includes('visual'), 'visual: true must enable the dimension')
  assert.ok(!enabled.includes('mutation'), 'mutation: false must disable it')
  assert.ok(!enabled.includes('acceptance'), 'spec_as_source: false must disable acceptance')
})

test('spec_as_source drives the acceptance dimension', () => {
  const { enabled } = readVerification('verification:\n  spec_as_source: true\n')
  assert.ok(enabled.includes('acceptance'))
})

test('floors fall back to the documented defaults', () => {
  const { floors } = readVerification('verification: {}')
  assert.equal(floors.runtime, 100)
  assert.equal(floors.visual, 100)
  assert.equal(floors.spec, 80)
  assert.equal(floors.code, 60)
  assert.equal(floors.mutation, 70)
})

test('a floor outside 0-100 is rejected loudly', () => {
  assert.throws(
    () => readVerification('verification:\n  floors: { spec: 120 }\n'),
    /floor for "spec"/,
    'an out-of-range floor must name the dimension',
  )
})

test('an unknown dimension in floors is rejected', () => {
  assert.throws(
    () => readVerification('verification:\n  floors: { speed: 50 }\n'),
    /unknown dimension "speed"/,
  )
})

test('every dimension has a declared floor', () => {
  const { floors } = readVerification(base)
  for (const dimension of ALL_DIMENSIONS) {
    assert.equal(typeof floors[dimension], 'number', `${dimension} has no floor`)
  }
})

test('operational settings come through with defaults', () => {
  const settings = readVerification('verification: {}')
  assert.equal(settings.maxIterations, 5)
  assert.equal(settings.evaluatorModel, 'sonnet')
  assert.equal(settings.subagents, true)
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

```bash
node --test tests/config.test.mjs
```

Attendu : `Cannot find module ... scripts/lib/config.mjs`.

- [ ] **Step 3: Écrire l'implémentation minimale**

Créer `scripts/lib/config.mjs` :

```javascript
import { parse } from 'yaml'

export const ALL_DIMENSIONS = ['spec', 'runtime', 'code', 'visual', 'mutation', 'acceptance']

const ALWAYS_ON = ['spec', 'runtime', 'code']

const DEFAULT_FLOORS = {
  spec: 80,
  runtime: 100,
  code: 60,
  visual: 100,
  mutation: 70,
  acceptance: 100,
}

export function readVerification(configSource) {
  const config = parse(String(configSource)) ?? {}
  const v = config.verification ?? {}

  const floors = { ...DEFAULT_FLOORS }
  for (const [dimension, value] of Object.entries(v.floors ?? {})) {
    if (!ALL_DIMENSIONS.includes(dimension)) {
      throw new Error(`unknown dimension "${dimension}" in verification.floors`)
    }
    if (typeof value !== 'number' || value < 0 || value > 100) {
      throw new Error(`floor for "${dimension}" must be a number between 0 and 100, got ${value}`)
    }
    floors[dimension] = value
  }

  const enabled = [...ALWAYS_ON]
  if (v.visual) enabled.push('visual')
  if (v.mutation) enabled.push('mutation')
  if (v.spec_as_source) enabled.push('acceptance')

  return {
    enabled,
    floors,
    maxIterations: v.max_iterations ?? 5,
    evaluatorModel: v.evaluator_model ?? 'sonnet',
    subagents: v.subagents ?? true,
  }
}
```

- [ ] **Step 4: Lancer les tests**

```bash
node --test
```

Attendu : les 8 nouveaux tests passent.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/config.mjs tests/config.test.mjs
git commit -m "feat: read and validate the verification block of config.yaml"
```

---

### Task 3: Parseur de `tasks.md`

**Files:**
- Create: `scripts/lib/tasks.mjs`
- Test: `tests/tasks.test.mjs`

**Interfaces:**
- Consumes: rien
- Produces: `TASK_TYPES` (`['RED','GREEN','REFACTOR','VISUAL','FIX','ACCEPT']`), `parseTasks(source: string) => Group[]` où `Group = {number: number, title: string, tasks: Task[]}` et `Task = {ordinal: string, type: string|null, description: string, done: boolean, lines: string[]}`. La Task 6 s'en sert pour piloter la boucle d'apply.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `tests/tasks.test.mjs` :

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TASK_TYPES, parseTasks } from '../scripts/lib/tasks.mjs'

const SOURCE = `# Tasks

## 1. Token generation
- [x] 1.1 RED — an unknown email creates nothing
- [x] 1.2 GREEN — implement requestToken
- [ ] 1.3 VISUAL — hero block on /
      viewport: 1440
      assert  .hero  padding-block  → 224px
- [ ] 1.4 REFACTOR — clean up, tests stay green

## 2. Expiry
- [ ] 2.1 RED — an expired token is refused
- [ ] 2.2 Write the docs
`

test('the six task types are declared', () => {
  assert.deepEqual([...TASK_TYPES].sort(), [
    'ACCEPT', 'FIX', 'GREEN', 'REFACTOR', 'RED', 'VISUAL',
  ].sort())
})

test('groups are parsed with their number and title', () => {
  const groups = parseTasks(SOURCE)
  assert.equal(groups.length, 2)
  assert.equal(groups[0].number, 1)
  assert.equal(groups[0].title, 'Token generation')
  assert.equal(groups[1].number, 2)
})

test('the keyword after the ordinal decides the type', () => {
  const [group] = parseTasks(SOURCE)
  assert.deepEqual(
    group.tasks.map((t) => t.type),
    ['RED', 'GREEN', 'VISUAL', 'REFACTOR'],
  )
})

test('a task with no known keyword has a null type rather than being dropped', () => {
  const [, second] = parseTasks(SOURCE)
  const plain = second.tasks.find((t) => t.ordinal === '2.2')
  assert.ok(plain, 'the untyped task must still be parsed')
  assert.equal(plain.type, null)
  assert.equal(plain.description, 'Write the docs')
})

test('checkbox state is captured', () => {
  const [group] = parseTasks(SOURCE)
  assert.deepEqual(
    group.tasks.map((t) => t.done),
    [true, true, false, false],
  )
})

test('indented continuation lines stay attached to their task', () => {
  const [group] = parseTasks(SOURCE)
  const visual = group.tasks.find((t) => t.type === 'VISUAL')
  assert.equal(visual.lines.length, 2)
  assert.match(visual.lines[0], /viewport: 1440/)
  assert.match(visual.lines[1], /padding-block/)
})

test('the ordinal letter never decides the type', () => {
  // 1.Z is the convention for a last-in-group task upstream; it must not be
  // treated as special. Only the keyword counts.
  const groups = parseTasks('## 1. G\n- [ ] 1.Z GREEN — still a GREEN task\n')
  assert.equal(groups[0].tasks[0].type, 'GREEN')
  assert.equal(groups[0].tasks[0].ordinal, '1.Z')
})

test('an em dash is optional after the keyword', () => {
  const groups = parseTasks('## 1. G\n- [ ] 1.1 RED write the failing test\n')
  assert.equal(groups[0].tasks[0].type, 'RED')
  assert.equal(groups[0].tasks[0].description, 'write the failing test')
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

```bash
node --test tests/tasks.test.mjs
```

Attendu : `Cannot find module ... scripts/lib/tasks.mjs`.

- [ ] **Step 3: Écrire l'implémentation minimale**

Créer `scripts/lib/tasks.mjs` :

```javascript
export const TASK_TYPES = ['RED', 'GREEN', 'REFACTOR', 'VISUAL', 'FIX', 'ACCEPT']

const GROUP = /^##\s+(\d+)\.\s+(.*)$/
const TASK = /^- \[([ xX])\]\s+(\S+)\s+(.*)$/
const CONTINUATION = /^\s{2,}\S/

export function parseTasks(source) {
  const groups = []
  let group = null
  let task = null

  for (const line of String(source).split(/\r?\n/)) {
    const groupMatch = line.match(GROUP)
    if (groupMatch) {
      group = { number: Number(groupMatch[1]), title: groupMatch[2].trim(), tasks: [] }
      groups.push(group)
      task = null
      continue
    }

    const taskMatch = line.match(TASK)
    if (taskMatch && group) {
      const [, checkbox, ordinal, rest] = taskMatch
      const keyword = rest.split(/\s+/)[0]
      const type = TASK_TYPES.includes(keyword) ? keyword : null
      const description = type
        ? rest.slice(keyword.length).replace(/^\s*—\s*|^\s+/, '').trim()
        : rest.trim()
      task = { ordinal, type, description, done: checkbox.toLowerCase() === 'x', lines: [] }
      group.tasks.push(task)
      continue
    }

    if (task && CONTINUATION.test(line)) task.lines.push(line.trim())
  }

  return groups
}
```

- [ ] **Step 4: Lancer les tests**

```bash
node --test
```

Attendu : les 8 nouveaux tests passent.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/tasks.mjs tests/tasks.test.mjs
git commit -m "feat: parse tasks.md into groups and typed tasks"
```

---

### Task 4: Calcul du verdict

**Files:**
- Create: `scripts/lib/verdict.mjs`
- Test: `tests/verdict.test.mjs`

**Interfaces:**
- Consumes: `enabled` et `floors` (Task 2)
- Produces: `UNKNOWN` (symbole chaîne `'UNKNOWN'`), `computeVerdict({scores, floors, enabled}) => {status: 'PASS'|'RETRY'|'BLOCK', failed: string[], unevaluated: string[]}`. La Task 5 le fait exécuter par l'évaluateur.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `tests/verdict.test.mjs` :

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { UNKNOWN, computeVerdict } from '../scripts/lib/verdict.mjs'

const floors = { spec: 80, runtime: 100, code: 60, visual: 100, mutation: 70, acceptance: 100 }
const enabled = ['spec', 'runtime', 'code', 'visual']

test('every enabled dimension at or above its floor passes', () => {
  const v = computeVerdict({
    scores: { spec: 80, runtime: 100, code: 60, visual: 100 },
    floors,
    enabled,
  })
  assert.deepEqual(v, { status: 'PASS', failed: [], unevaluated: [] })
})

test('a single dimension below its floor forces RETRY', () => {
  const v = computeVerdict({
    scores: { spec: 95, runtime: 100, code: 90, visual: 60 },
    floors,
    enabled,
  })
  assert.equal(v.status, 'RETRY')
  assert.deepEqual(v.failed, ['visual'])
})

test('a weak dimension is never redeemed by strong ones', () => {
  // Under the weighted total this scored 86 and passed. It must not.
  const v = computeVerdict({
    scores: { spec: 90, runtime: 100, code: 85, visual: 60 },
    floors,
    enabled,
  })
  assert.equal(v.status, 'RETRY')
})

test('a disabled dimension is ignored even when scored', () => {
  const v = computeVerdict({
    scores: { spec: 90, runtime: 100, code: 90, visual: 100, mutation: 10 },
    floors,
    enabled,
  })
  assert.equal(v.status, 'PASS')
})

test('an unevaluable dimension BLOCKS rather than RETRIES', () => {
  // Infrastructure failure is not a code defect: retrying the code is futile.
  const v = computeVerdict({
    scores: { spec: 90, runtime: 100, code: 90, visual: UNKNOWN },
    floors,
    enabled,
  })
  assert.equal(v.status, 'BLOCK')
  assert.deepEqual(v.unevaluated, ['visual'])
})

test('BLOCK wins over RETRY when both apply', () => {
  const v = computeVerdict({
    scores: { spec: 10, runtime: 100, code: 90, visual: UNKNOWN },
    floors,
    enabled,
  })
  assert.equal(v.status, 'BLOCK')
})

test('a missing score for an enabled dimension is unevaluated, not zero', () => {
  const v = computeVerdict({
    scores: { spec: 90, runtime: 100, code: 90 },
    floors,
    enabled,
  })
  assert.equal(v.status, 'BLOCK')
  assert.deepEqual(v.unevaluated, ['visual'])
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

```bash
node --test tests/verdict.test.mjs
```

Attendu : `Cannot find module ... scripts/lib/verdict.mjs`.

- [ ] **Step 3: Écrire l'implémentation minimale**

Créer `scripts/lib/verdict.mjs` :

```javascript
export const UNKNOWN = 'UNKNOWN'

export function computeVerdict({ scores, floors, enabled }) {
  const unevaluated = []
  const failed = []

  for (const dimension of enabled) {
    const score = scores[dimension]
    if (score === undefined || score === null || score === UNKNOWN) {
      unevaluated.push(dimension)
      continue
    }
    if (score < floors[dimension]) failed.push(dimension)
  }

  // A dimension that could not be evaluated is an infrastructure problem, not
  // a code defect — retrying the implementation would never clear it.
  if (unevaluated.length > 0) return { status: 'BLOCK', failed, unevaluated }
  if (failed.length > 0) return { status: 'RETRY', failed, unevaluated }
  return { status: 'PASS', failed, unevaluated }
}
```

- [ ] **Step 4: Lancer les tests**

```bash
node --test
```

Attendu : les 7 nouveaux tests passent.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/verdict.mjs tests/verdict.test.mjs
git commit -m "feat: verdict by per-dimension floors, blocking on unevaluable dimensions"
```

---

### Task 5: Le sous-agent évaluateur

**Files:**
- Create: `agents/evaluator.md`
- Create: `scripts/verdict-cli.mjs`
- Test: `tests/evaluator-contract.test.mjs`

**Interfaces:**
- Consumes: `computeVerdict` (Task 4), `readVerification` (Task 2)
- Produces: la commande `node scripts/verdict-cli.mjs <configPath> <scoresJson>`, qui imprime le verdict en JSON. L'évaluateur l'appelle plutôt que de calculer le verdict de tête — un modèle ne doit pas arbitrer sa propre note.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `tests/evaluator-contract.test.mjs` :

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseFrontmatter } from '../scripts/lib/frontmatter.mjs'

const pluginRoot = fileURLToPath(new URL('../', import.meta.url))
const cli = join(pluginRoot, 'scripts', 'verdict-cli.mjs')
const agentPath = join(pluginRoot, 'agents', 'evaluator.md')

test('the evaluator agent exists with Claude Code frontmatter', () => {
  assert.ok(existsSync(agentPath))
  const frontmatter = parseFrontmatter(readFileSync(agentPath, 'utf8'))
  assert.equal(frontmatter.name, 'evaluator')
  assert.ok(frontmatter.description?.length > 0)
  assert.ok(['haiku', 'sonnet', 'opus'].includes(frontmatter.model))
})

test('the evaluator prompt encodes the design rules', () => {
  const body = readFileSync(agentPath, 'utf8')
  assert.match(body, /requesting-code-review/, 'it must run the code review itself')
  assert.match(body, /CRITICAL|HIGH/, 'it must block on critical findings without scoring')
  assert.match(body, /verdict-cli\.mjs/, 'it must not compute the verdict itself')
  assert.match(body, /re-?run|replay/i, 'it must replay the VISUAL assertions rather than trust them')
})

test('verdict-cli returns PASS for scores above the floors', () => {
  const dir = mkdtempSync(join(tmpdir(), 'idd-verdict-'))
  const configPath = join(dir, 'config.yaml')
  writeFileSync(configPath, 'verification:\n  visual: true\n', 'utf8')

  const out = execFileSync(
    'node',
    [cli, configPath, JSON.stringify({ spec: 90, runtime: 100, code: 80, visual: 100 })],
    { encoding: 'utf8' },
  )
  assert.deepEqual(JSON.parse(out), { status: 'PASS', failed: [], unevaluated: [] })
})

test('verdict-cli BLOCKS when an enabled dimension was not scored', () => {
  const dir = mkdtempSync(join(tmpdir(), 'idd-verdict-'))
  const configPath = join(dir, 'config.yaml')
  writeFileSync(configPath, 'verification:\n  visual: true\n', 'utf8')

  const out = execFileSync(
    'node',
    [cli, configPath, JSON.stringify({ spec: 90, runtime: 100, code: 80 })],
    { encoding: 'utf8' },
  )
  assert.equal(JSON.parse(out).status, 'BLOCK')
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

```bash
node --test tests/evaluator-contract.test.mjs
```

Attendu : ÉCHEC — ni `agents/evaluator.md` ni `scripts/verdict-cli.mjs` n'existent.

- [ ] **Step 3: Écrire le CLI de verdict**

Créer `scripts/verdict-cli.mjs` :

```javascript
#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { readVerification } from './lib/config.mjs'
import { computeVerdict } from './lib/verdict.mjs'

const [configPath, scoresJson] = process.argv.slice(2)
if (!configPath || !scoresJson) {
  console.error('usage: verdict-cli.mjs <configPath> <scoresJson>')
  process.exit(2)
}

const { enabled, floors } = readVerification(readFileSync(configPath, 'utf8'))
const scores = JSON.parse(scoresJson)

console.log(JSON.stringify(computeVerdict({ scores, floors, enabled })))
```

- [ ] **Step 4: Écrire l'agent**

Créer `agents/evaluator.md` :

```markdown
---
name: evaluator
description: Scores one task group against the change contract and returns PASS, RETRY or BLOCK. Dispatched by /idd:apply at the end of each group, never invoked directly.
model: sonnet
---

You are an external evaluator with a skeptical lens. You have no knowledge of
the implementation decisions made during this session, and you must not assume
any. A ticked checkbox is a claim, not evidence.

You receive only: the group's contract, the change's specs, and the git diff
for the group. Nothing else is available to you, and you must not go looking.

## Sequence

1. **Code review first.** Invoke `superpowers:requesting-code-review` on the
   diff. If it reports any CRITICAL or HIGH severity finding, return
   `STATUS: BLOCK` with those findings and **stop — do not score anything**.

2. **Score `spec`** (0-100): compare the diff against each SHALL statement in
   the contract. The score is the proportion satisfied.

3. **Score `runtime`** (0-100): run the project's test commands. 100 if every
   test passes, 0 if the command cannot run at all, otherwise the proportion
   passing. If there are no test commands configured, report `"UNKNOWN"`.

4. **Score `code`** (0-100): from the residual MEDIUM and LOW findings of the
   review in step 1.

5. **Score `visual`** if the dimension is enabled: **re-run** the assertions
   declared in the group's VISUAL tasks yourself, through dev-browser. Never
   read the result the implementation session claimed. 100 only if every
   assertion holds. If the dev stack cannot be started, report `"UNKNOWN"` —
   not 0. A broken environment is not a broken implementation.

6. **Score `mutation`** if enabled: run the mutation tool scoped to the
   group's changed files. Report the mutation score. If the tool cannot run,
   report `"UNKNOWN"`.

7. **Score `acceptance`** if enabled: run the acceptance suite. 100 only if
   every scenario passes.

8. **Check the REFACTOR rule.** If the group contains a REFACTOR task whose
   diff modifies any test assertion, behaviour changed under cover of
   cleanup: add it as a `spec` finding and cap that dimension at 50.

9. **Check the TDD rule.** Every GREEN task must have a corresponding test
   file change somewhere in the group's diff. A GREEN with no test is a
   `spec` finding.

10. **Compute the verdict — do not decide it yourself.** Run:

    `node "${CLAUDE_PLUGIN_ROOT}/scripts/verdict-cli.mjs" openspec/config.yaml '<scores as JSON>'`

    Use `"UNKNOWN"` for any dimension you could not evaluate. Report the
    status it returns, verbatim.

## Output

Return, in this order: the status, the per-dimension scores, the findings that
produced them, and — when the status is RETRY — a list of concrete fix tasks
named `<group>.F<n> FIX — <actionable fix>`.

Never soften a verdict. A PASS obtained by skipping a dimension is worse than
a failure, because it lies.
```

- [ ] **Step 5: Lancer les tests**

```bash
node --test
```

Attendu : les 4 nouveaux tests passent.

- [ ] **Step 6: Commit**

```bash
git add agents/evaluator.md scripts/verdict-cli.mjs tests/evaluator-contract.test.mjs
git commit -m "feat: evaluator subagent with an out-of-band verdict computation"
```

---

### Task 6: La commande `/idd:apply`

**Files:**
- Create: `commands/idd/apply.md`
- Modify: `schema/schema.yaml`, `schema-lite/schema.yaml` (bloc `apply`)
- Test: `tests/apply-contract.test.mjs`

**Interfaces:**
- Consumes: `parseTasks` (Task 3), `readVerification` (Task 2), l'agent `evaluator` (Task 5)
- Produces: la commande `/idd:apply`, et le bloc `apply` des deux schémas remplacé par les gates.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `tests/apply-contract.test.mjs` :

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse } from 'yaml'

const root = new URL('../', import.meta.url)
const apply = readFileSync(new URL('commands/idd/apply.md', root), 'utf8')

test('apply mandates the TDD skill at session start', () => {
  assert.match(apply, /superpowers:test-driven-development/)
})

test('apply wires the multi-agent layer', () => {
  assert.match(apply, /superpowers:using-git-worktrees/)
  assert.match(apply, /superpowers:subagent-driven-development/)
  assert.match(apply, /superpowers:verification-before-completion/)
})

test('apply forbids calling the code review directly', () => {
  assert.match(apply, /NEVER invoke `superpowers:requesting-code-review` directly/)
})

test('apply documents the degraded fallback and its loss', () => {
  assert.match(apply, /superpowers:executing-plans/)
  assert.match(apply, /does not transitively activate/i)
})

test('apply refuses to start rather than silently skipping a dimension', () => {
  assert.match(apply, /refuse to start/i)
})

test('both schemas replaced the upstream apply instruction', () => {
  for (const dir of ['schema', 'schema-lite']) {
    const schema = parse(readFileSync(new URL(`${dir}/schema.yaml`, root), 'utf8'))
    assert.doesNotMatch(
      schema.apply.instruction,
      /work through pending tasks, mark complete as you go/,
      `${dir}: still carries the upstream apply instruction`,
    )
    assert.match(schema.apply.instruction, /idd:apply/, `${dir}: apply must point at the command`)
  }
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

```bash
node --test tests/apply-contract.test.mjs
```

Attendu : ÉCHEC — `commands/idd/apply.md` n'existe pas.

- [ ] **Step 3: Écrire la commande**

Créer `commands/idd/apply.md` :

```markdown
---
name: "IDD: Apply"
description: "Implement a change under enforced TDD, with a scored evaluator gate at the end of each task group"
---

Implement the change named in the argument, under hard gates.

## Before anything

Read `openspec/config.yaml`. Then check every enabled dimension can actually
be evaluated, and **refuse to start** if one cannot:

- `visual: true` but dev-browser is not installed → stop, say so.
- `mutation: true` but no mutation tool is configured → stop, say so.
- `project.test_commands` empty → warn that `runtime` will report UNKNOWN, and
  that every group will therefore BLOCK. Ask whether to continue.

Never degrade silently. A dimension that is enabled but unevaluable stops the
run; it does not quietly disappear from the verdict.

## Session setup

1. Create an isolated workspace with `superpowers:using-git-worktrees`, unless
   the project's dev stack cannot serve a worktree — with a single-docroot
   stack such as DDEV it cannot, so work in place and say why.
2. Invoke `superpowers:test-driven-development`. This is mandatory and holds
   "no GREEN without a preceding RED" for the whole session.
3. Read `tasks.md` and group the work:
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/lib/tasks-cli.mjs" openspec/changes/<id>/tasks.md`

## Per task

Dispatch on the keyword **after** the ordinal — never on the ordinal itself.

| Keyword | What to do |
| --- | --- |
| `RED` | write the test, run it, confirm the failure mode matches the description |
| `GREEN` | minimal code, test green |
| `REFACTOR` | clean up at constant behaviour; touch no test assertion |
| `VISUAL` | run the declared assertions through dev-browser |
| `FIX` | apply the fix from the previous evaluation round |
| `ACCEPT` | run the Gherkin scenario (only when spec_as_source is on) |

When `verification.subagents` is true, dispatch one subagent per task with
`superpowers:subagent-driven-development`. When false, do the work directly.

If subagents are unavailable, fall back to `superpowers:executing-plans` — but
note that it **does not transitively activate** TDD or code review, so in that
mode you must invoke the gates explicitly yourself.

**NEVER invoke `superpowers:requesting-code-review` directly during apply.**
The evaluator runs it internally; calling it here pays for the same review
twice.

## End of each group

Dispatch the `evaluator` agent. Pass it only the group's contract, the
change's specs, and the group's diff — never this conversation.

- `PASS` → next group.
- `RETRY` → append the fix tasks it generated to `tasks.md` and work them, then
  re-dispatch. Stop at `verification.max_iterations` and report to the user.
- `BLOCK` → fix the reported CRITICAL/HIGH findings, or the infrastructure
  problem, before re-dispatching. Do not count a BLOCK as an iteration of the
  RETRY loop: it is not a code-quality failure.

Record each round in `verification.md`.

## End of the change

Invoke `superpowers:verification-before-completion`, then hand off to
`/idd:verify`.
```

- [ ] **Step 4: Remplacer le bloc `apply` des deux schémas**

Dans `schema/schema.yaml` **et** `schema-lite/schema.yaml`, remplacer l'instruction du bloc `apply` par :

```yaml
apply:
  requires:
    - tasks
  tracks: tasks.md
  instruction: |
    Do not implement these tasks directly. Run /idd:apply, which enforces the
    TDD gates and dispatches the evaluator at the end of each task group.

    Implementing without it produces a change that has never been verified
    against its own specs.
```

- [ ] **Step 5: Écrire le petit CLI du parseur**

Créer `scripts/lib/tasks-cli.mjs` :

```javascript
#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { parseTasks } from './tasks.mjs'

const [path] = process.argv.slice(2)
if (!path) {
  console.error('usage: tasks-cli.mjs <tasks.md>')
  process.exit(2)
}
console.log(JSON.stringify(parseTasks(readFileSync(path, 'utf8')), null, 2))
```

- [ ] **Step 6: Lancer les tests**

```bash
node --test
```

Attendu : les 6 nouveaux tests passent, et le test du graphe du Plan 1 continue de passer (seule l'instruction d'`apply` a changé, pas ses `requires`).

- [ ] **Step 7: Commit**

```bash
git add commands/idd/apply.md scripts/lib/tasks-cli.mjs schema/ schema-lite/ tests/
git commit -m "feat: /idd:apply with hard TDD gates and the evaluator loop"
```

---

### Task 7: `/idd:propose`, `/idd:verify`, `/idd:archive`

**Files:**
- Create: `commands/idd/propose.md`, `commands/idd/verify.md`, `commands/idd/archive.md`
- Test: `tests/commands-contract.test.mjs`

**Interfaces:**
- Consumes: les deux schémas (Task 1), l'artefact `verification` (Plan 1)
- Produces: le cycle complet en commandes.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `tests/commands-contract.test.mjs` :

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { parseFrontmatter } from '../scripts/lib/frontmatter.mjs'

const commandsRoot = fileURLToPath(new URL('../commands/idd/', import.meta.url))
const read = (name) => readFileSync(join(commandsRoot, name), 'utf8')

test('every command has frontmatter with a name and a description', () => {
  for (const name of ['init.md', 'apply.md', 'propose.md', 'verify.md', 'archive.md']) {
    assert.ok(existsSync(join(commandsRoot, name)), `missing command: ${name}`)
    const frontmatter = parseFrontmatter(read(name))
    assert.ok(frontmatter, `${name}: no frontmatter`)
    assert.ok(frontmatter.name?.length > 0, `${name}: no name`)
    assert.ok(frontmatter.description?.length > 0, `${name}: no description`)
  }
})

test('propose carries the tier guard', () => {
  const propose = read('propose.md')
  assert.match(propose, /tactical fix|docs-only|dependency bump/i)
  assert.match(propose, /do not (open|create) a change/i)
})

test('propose picks the schema per change rather than editing config', () => {
  const propose = read('propose.md')
  assert.match(propose, /--schema idd-claude-lite/)
  assert.match(propose, /--schema idd-claude\b/)
  assert.doesNotMatch(propose, /edit .*config\.yaml/i)
})

test('verify refuses to pass on unticked tasks', () => {
  assert.match(read('verify.md'), /every checkbox|all tasks .*ticked/i)
})

test('archive gates on a green verification', () => {
  const archive = read('archive.md')
  assert.match(archive, /verification\.md/)
  assert.match(archive, /guard(rail)?|not a lock/i, 'the guard must state it is bypassable')
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

```bash
node --test tests/commands-contract.test.mjs
```

Attendu : ÉCHEC — les trois commandes n'existent pas.

- [ ] **Step 3: Écrire `commands/idd/propose.md`**

```markdown
---
name: "IDD: Propose"
description: "Open an OpenSpec change at the right tier and generate its artifacts"
---

Open a change for the work described in the argument.

## Tier guard — run this first

If the work is a tactical fix, a docs-only change, a dependency bump, or a
feasibility question, **do not open a change**. Say so, say why, and stop. The
pipeline costs more than the work is worth, and the upstream schema
documentation says as much.

Otherwise pick the tier:

- **Bounded** — no new architectural pattern, no new external dependency, no
  security or migration complexity, no ambiguity needing a decision recorded:

  `openspec new change <id> --schema idd-claude-lite`

- **Architectural** — any of the above applies:

  `openspec new change <id> --schema idd-claude`

The schema is recorded in the change's `.openspec.yaml`; every later command
reads it back. Never edit `openspec/config.yaml` to switch tiers — it only
sets the default.

If `/idd:explore` already classified this work, use its verdict instead of
re-deciding.

## Then

Generate the artifacts in the order the schema allows, reading
`openspec instructions <artifact> --change <id>` for each. Apply the project
rules from `config.yaml`. Stop after each artifact and let the user read it.

If, while writing the proposal for a bounded change, one of the architectural
criteria turns out to apply, stop and tell the user to recreate the change
with the full schema. It is cheap now and expensive after `tasks.md` exists.
```

- [ ] **Step 4: Écrire `commands/idd/verify.md`**

```markdown
---
name: "IDD: Verify"
description: "Check that the implementation is complete and its verification is green"
---

Verify the change named in the argument.

1. Run `openspec validate --all --json` and report any structural failure.
2. Read `tasks.md`: **every checkbox must be ticked**. List any that are not
   and stop — an unfinished change is not verifiable.
3. Read `verification.md`. Every group must have reached PASS. Report any
   group that ended in BLOCK or hit the iteration cap.
4. Confirm the working tree is clean and the change's commits exist.

Report PASS, PASS WITH WARNINGS, or FAIL, and write the outcome into
`verification.md`. On FAIL, name the artifact to go back to.
```

- [ ] **Step 5: Écrire `commands/idd/archive.md`**

```markdown
---
name: "IDD: Archive"
description: "Fold the change's delta specs into the living specs and archive it"
---

Archive the change named in the argument.

**Guard:** read `verification.md` first. If it does not record a PASS for every
group, refuse and tell the user to run `/idd:verify`. This is a guardrail, not
a lock — `openspec archive` remains callable directly, and the schema cannot
prevent it, because archive is a CLI command and not a node of the artifact
graph.

Then run `openspec archive <id>`, which folds the delta specs into
`openspec/specs/` and moves the change under `openspec/changes/archive/`.

Report which capabilities the living specs gained or changed. That tree is now
the answer to "what does this system do today" — it is the reason the pipeline
exists.
```

- [ ] **Step 6: Lancer les tests**

```bash
node --test
```

Attendu : les 5 nouveaux tests passent, et toute la suite avec.

- [ ] **Step 7: Commit**

```bash
git add commands/idd/ tests/commands-contract.test.mjs
git commit -m "feat: propose, verify and archive commands"
```

---

## Auto-relecture

**Couverture de la spec.** Ce plan couvre le typage des tâches, les trois niveaux de forçage du TDD, la couche multi-agent, l'évaluateur, le verdict par planchers, les dégradations liées à apply, les deux schémas et la garde de niveau. **Non couverts et renvoyés au Plan 3** : le gate visuel lui-même (la skill `visual-verification` et le runner d'assertions dev-browser — la Task 5 décrit son usage par l'évaluateur mais l'outil n'existe pas encore, donc `visual: true` ne sera réellement utilisable qu'au Plan 3). **Renvoyés au Plan 4** : l'extracteur Gherkin et le pack d'acceptation. Le mutation testing n'a pas de tâche ici : il se branche sur la même couture que le visuel, au Plan 3.

**Conséquence traitée en Task 1, step 6 :** la config par défaut ne peut pas garder `visual: true` alors que le runner n'existe pas, sinon `/idd:apply` refuse de démarrer — cohérent avec la règle « pas de dégradation silencieuse », mais le plan serait inutilisable. `defaultConfig()` passe donc à `visual: false`, que le Plan 3 rebasculera dans le commit qui livre le runner.

**Types.** `readVerification` prend une **chaîne** et non un chemin, ce dont dépendent les tests de la Task 2 et l'usage dans `verdict-cli.mjs` (qui lit le fichier lui-même). `computeVerdict` reçoit `{scores, floors, enabled}` et rend `{status, failed, unevaluated}`, consommé tel quel par `verdict-cli.mjs`. `parseTasks` rend un tableau de groupes, exposé en JSON par `tasks-cli.mjs`. `promotedVersion` gagne un second paramètre optionnel, rétrocompatible avec son appel du Plan 1.
