# idd-claude — Plan 3 : `/idd:explore` et le gate visuel

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer la commande `/idd:explore` prévue par la spec mais planifiée nulle part, puis rendre la dimension `visual` réellement évaluable — ce qui rend l'outil utilisable sur un projet front comme Pixid.

**Architecture:** Même découpage que les plans précédents. L'analyse du format d'assertions et l'évaluation des mesures sont des fonctions pures dans `scripts/lib/visual.mjs`, testées en TDD ; seul l'appel à dev-browser est une coquille mince (`scripts/visual-cli.mjs`) que les tests n'exercent pas.

**Tech Stack:** Node 22 (`node --test`), `yaml`, dev-browser, OpenSpec ≥ 1.9.0, Superpowers ≥ 6.3.0.

**Spec:** `docs/superpowers/specs/2026-08-17-idd-claude-design.md`

## Global Constraints

- Reprend les contraintes des Plans 1 et 2 (anglais dans le repo, MIT, `node --test`, planchers, pas de dégradation silencieuse).
- **La migration vers vitest est reportée.** Elle reste nécessaire pour appliquer le mutation testing à `idd-claude` lui-même ; le Plan 4 tranchera entre migrer et utiliser le `command-runner` générique de Stryker. Sans incidence sur les projets consommateurs.
- **Le screenshot est une pièce à conviction, jamais un critère.** Seules les valeurs mesurées décident.
- Le plancher `visual` reste à **100** : une assertion mesurée qui casse est un fait, pas une note.

---

## Structure des fichiers

| Fichier | Responsabilité |
| --- | --- |
| `commands/idd/explore.md` | la commande d'exploration, adossée à `superpowers:brainstorming` |
| `skills/visual-verification/SKILL.md` | comment écrire une tâche `VISUAL` et ce que le gate garantit |
| `scripts/lib/visual.mjs` | analyse du format d'assertions, construction de la sonde, évaluation des mesures |
| `scripts/visual-cli.mjs` | exécute la sonde via dev-browser et imprime le résultat en JSON |

---

### Task 1: La commande `/idd:explore`

**Files:**
- Create: `commands/idd/explore.md`
- Modify: `tests/commands-contract.test.mjs`

**Interfaces:**
- Consumes: rien
- Produces: la commande `/idd:explore`, que `commands/idd/propose.md` référence déjà — ce renvoi est mort depuis le Plan 2 et cette tâche le répare.

- [x] **Step 1: Étendre le test de contrat**

Dans `tests/commands-contract.test.mjs`, ajouter `'explore.md'` à la liste du premier test, puis ajouter :

```javascript
test('explore delegates to brainstorming with a redefined terminal state', () => {
  const explore = read('explore.md')
  assert.match(explore, /superpowers:brainstorming/)
  assert.match(explore, /spike/i)
  assert.match(explore, /bounded/i)
  assert.match(explore, /architectural/i)
  // The whole point: it must not let brainstorming write competing artifacts.
  assert.match(explore, /do not write.*design doc|never write.*design doc/i)
  assert.match(explore, /writing-plans/, 'it must name the skill it is overriding')
  assert.match(explore, /idd:propose/, 'it must hand off rather than implement')
})

test('no command references a command that does not exist', () => {
  const existing = readdirSync(commandsRoot).map((f) => f.replace(/\.md$/, ''))
  for (const file of readdirSync(commandsRoot)) {
    const body = read(file)
    for (const [, referenced] of body.matchAll(/\/idd:([a-z-]+)/g)) {
      assert.ok(
        existing.includes(referenced),
        `${file} references /idd:${referenced}, which has no command file`,
      )
    }
  }
})
```

Ajouter `readdirSync` à l'import de `node:fs` en tête du fichier.

Le second test est le vrai garde-fou : c'est exactement le défaut qui a échappé au Plan 2, et il ne pourra plus repasser.

- [x] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

```bash
node --test
```

Attendu : ÉCHEC sur `missing command: explore.md`, et sur le renvoi mort depuis `propose.md`.

- [x] **Step 3: Écrire la commande**

Créer `commands/idd/explore.md` :

```markdown
---
name: "IDD: Explore"
description: "Think a change through before opening it, and decide whether it deserves the pipeline at all"
---

Explore the idea in the argument. **Nothing is written to disk in this
command** — its output is a decision and, at most, a validated design held in
the conversation.

## Delegate to brainstorming

Invoke `superpowers:brainstorming` on the idea. Let it classify the work, ask
its questions one at a time, propose approaches, and present its design.

## Override its terminal state

`brainstorming` normally ends by writing a design document under
`docs/superpowers/specs/` and invoking `superpowers:writing-plans`. **Do not
let it do either here.** Those outputs would compete with OpenSpec's own
`design.md` and `tasks.md`, which is the exact duplication this project exists
to avoid. This override is deliberate: project instructions take precedence
over a skill's default flow.

Instead, hand off according to the classification:

| Classification | What to do |
| --- | --- |
| **Spike** | Report the answer and stop. Open no change — a feasibility question does not earn a change folder. |
| **Bounded** | Report the short design, then `/idd:propose <topic>` — which will create the change with `--schema idd-claude-lite`. |
| **Architectural** | Report the approved design in full, then `/idd:propose <topic>` — which will create the change with `--schema idd-claude`. The design content you just validated becomes the `design.md` artifact; do not rewrite it from scratch there. |

Pass your classification explicitly to `/idd:propose` so it does not re-decide.

## Visual companion

`brainstorming` offers its browser companion by itself, just in time, and only
when a question is genuinely visual — choosing between two block layouts,
comparing two mockups. Never force it, and never offer it for a conceptual
question that merely concerns a UI topic.

It writes its mockups to `<project>/.superpowers/brainstorm/`. If that path is
not in `.gitignore`, add it before accepting.
```

- [x] **Step 4: Lancer les tests**

```bash
node --test
```

Attendu : tous verts, dont les 2 nouveaux.

- [x] **Step 5: Commit**

```bash
git add commands/idd/explore.md tests/commands-contract.test.mjs
git commit -m "feat: /idd:explore, and a test that catches dangling command references"
```

---

### Task 2: Le format d'assertions visuelles

**Files:**
- Create: `scripts/lib/visual.mjs`
- Test: `tests/visual-parse.test.mjs`

**Interfaces:**
- Consumes: le champ `lines` des tâches produites par `parseTasks` (Plan 2)
- Produces: `parseVisualSpec(lines: string[]) => {url: string, viewport: number, assertions: Assertion[]}` où `Assertion` est `{kind: 'style', selector, property, expected, tolerance}` ou `{kind: 'count', selector, expected}`. La Task 3 le consomme.

**Format retenu.** Deux formes seulement, toutes deux mesurables sans ambiguïté :

```
- [ ] 3.4 VISUAL — Hero block
      url: /
      viewport: 1440
      assert .hero__title  font-size      68px
      assert .hero         padding-block  224px ±1
      count  .hero .layout-section > *    12
```

`assert` compare une propriété calculée (`getComputedStyle`) ; `count` compare
un nombre d'éléments. Rien d'autre — pas de prose du type « 12 colonnes », qui
ne se vérifie pas.

- [x] **Step 1: Écrire le test qui échoue**

Créer `tests/visual-parse.test.mjs` :

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseVisualSpec } from '../scripts/lib/visual.mjs'

const LINES = [
  'url: /',
  'viewport: 1440',
  'assert .hero__title  font-size      68px',
  'assert .hero         padding-block  224px ±1',
  'count  .hero .layout-section > *    12',
]

test('url and viewport are read from their own lines', () => {
  const spec = parseVisualSpec(LINES)
  assert.equal(spec.url, '/')
  assert.equal(spec.viewport, 1440)
})

test('viewport defaults to 1440 when absent', () => {
  assert.equal(parseVisualSpec(['url: /', 'count .x 1']).viewport, 1440)
})

test('a style assertion carries selector, property and expected value', () => {
  const [first] = parseVisualSpec(LINES).assertions
  assert.deepEqual(first, {
    kind: 'style',
    selector: '.hero__title',
    property: 'font-size',
    expected: '68px',
    tolerance: null,
  })
})

test('a tolerance is parsed off the end of the expected value', () => {
  const spec = parseVisualSpec(LINES)
  const padding = spec.assertions.find((a) => a.property === 'padding-block')
  assert.equal(padding.expected, '224px')
  assert.equal(padding.tolerance, 1)
})

test('a count assertion keeps a selector containing spaces', () => {
  const spec = parseVisualSpec(LINES)
  const count = spec.assertions.find((a) => a.kind === 'count')
  assert.equal(count.selector, '.hero .layout-section > *')
  assert.equal(count.expected, 12)
})

test('a VISUAL task with no url is a specification error', () => {
  assert.throws(() => parseVisualSpec(['viewport: 1440', 'count .x 1']), /url/)
})

test('a VISUAL task with no assertion is a specification error', () => {
  // An assertion-free visual task would pass silently — exactly the failure
  // mode this gate exists to prevent.
  assert.throws(() => parseVisualSpec(['url: /']), /at least one assertion/)
})

test('unknown directives are rejected rather than ignored', () => {
  assert.throws(() => parseVisualSpec(['url: /', 'looks nice']), /unrecognised line/)
})
```

- [x] **Step 2: Lancer le test pour vérifier qu'il échoue**

```bash
node --test tests/visual-parse.test.mjs
```

Attendu : `Cannot find module ... scripts/lib/visual.mjs`.

- [x] **Step 3: Écrire l'analyseur**

Créer `scripts/lib/visual.mjs` :

```javascript
const URL_LINE = /^url:\s*(\S+)\s*$/
const VIEWPORT_LINE = /^viewport:\s*(\d+)\s*$/
const STYLE_LINE = /^assert\s+(.+?)\s{2,}(\S+)\s{2,}(\S+)(?:\s+±(\d+(?:\.\d+)?))?\s*$/
const COUNT_LINE = /^count\s+(.+?)\s{2,}(\d+)\s*$/

export const DEFAULT_VIEWPORT = 1440

export function parseVisualSpec(lines) {
  let url = null
  let viewport = DEFAULT_VIEWPORT
  const assertions = []

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    const urlMatch = line.match(URL_LINE)
    if (urlMatch) {
      url = urlMatch[1]
      continue
    }

    const viewportMatch = line.match(VIEWPORT_LINE)
    if (viewportMatch) {
      viewport = Number(viewportMatch[1])
      continue
    }

    const styleMatch = line.match(STYLE_LINE)
    if (styleMatch) {
      const [, selector, property, expected, tolerance] = styleMatch
      assertions.push({
        kind: 'style',
        selector: selector.trim(),
        property,
        expected,
        tolerance: tolerance === undefined ? null : Number(tolerance),
      })
      continue
    }

    const countMatch = line.match(COUNT_LINE)
    if (countMatch) {
      assertions.push({
        kind: 'count',
        selector: countMatch[1].trim(),
        expected: Number(countMatch[2]),
      })
      continue
    }

    throw new Error(`unrecognised line in VISUAL task: "${line}"`)
  }

  if (!url) throw new Error('a VISUAL task must declare a url')
  if (assertions.length === 0) {
    throw new Error('a VISUAL task must declare at least one assertion')
  }

  return { url, viewport, assertions }
}
```

Les séparateurs sont **deux espaces ou plus**, ce qui permet aux sélecteurs
CSS de contenir des espaces (`.hero .layout-section > *`) sans guillemets.

- [x] **Step 4: Lancer les tests**

```bash
node --test
```

Attendu : les 8 nouveaux tests passent.

- [x] **Step 5: Commit**

```bash
git add scripts/lib/visual.mjs tests/visual-parse.test.mjs
git commit -m "feat: parse the VISUAL task assertion format"
```

---

### Task 3: Évaluation des mesures et sonde dev-browser

**Files:**
- Modify: `scripts/lib/visual.mjs`
- Create: `scripts/visual-cli.mjs`
- Test: `tests/visual-evaluate.test.mjs`

**Interfaces:**
- Consumes: `parseVisualSpec` (Task 2)
- Produces: `evaluateVisual(assertions, measured) => {score: number, failures: Failure[]}` et `buildProbeScript(spec, baseUrl) => string`. La Task 4 les branche dans l'évaluateur via `visual-cli.mjs`.

- [x] **Step 1: Écrire le test qui échoue**

Créer `tests/visual-evaluate.test.mjs` :

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateVisual, buildProbeScript, parseVisualSpec } from '../scripts/lib/visual.mjs'

const style = (over = {}) => ({
  kind: 'style',
  selector: '.hero',
  property: 'font-size',
  expected: '68px',
  tolerance: null,
  ...over,
})

test('an exact match passes', () => {
  const result = evaluateVisual([style()], ['68px'])
  assert.equal(result.score, 100)
  assert.deepEqual(result.failures, [])
})

test('a numeric value inside the tolerance passes', () => {
  const result = evaluateVisual([style({ tolerance: 1 })], ['68.6px'])
  assert.equal(result.score, 100)
})

test('a numeric value outside the tolerance fails and reports both values', () => {
  const result = evaluateVisual([style({ tolerance: 1 })], ['64px'])
  assert.equal(result.score, 0)
  assert.equal(result.failures.length, 1)
  assert.match(result.failures[0].message, /expected 68px/)
  assert.match(result.failures[0].message, /got 64px/)
})

test('without a tolerance, a near miss still fails', () => {
  assert.equal(evaluateVisual([style()], ['68.5px']).score, 0)
})

test('non-numeric values compare as strings', () => {
  const flex = style({ property: 'display', expected: 'flex' })
  assert.equal(evaluateVisual([flex], ['flex']).score, 100)
  assert.equal(evaluateVisual([flex], ['block']).score, 0)
})

test('a count assertion compares numerically', () => {
  const count = { kind: 'count', selector: '.item', expected: 12 }
  assert.equal(evaluateVisual([count], [12]).score, 100)
  assert.equal(evaluateVisual([count], [11]).score, 0)
})

test('a missing element is a failure, not a crash', () => {
  const result = evaluateVisual([style()], [null])
  assert.equal(result.score, 0)
  assert.match(result.failures[0].message, /not found|no element/i)
})

test('the score is the proportion of assertions that hold', () => {
  const assertions = [style(), { kind: 'count', selector: '.item', expected: 2 }]
  assert.equal(evaluateVisual(assertions, ['68px', 2]).score, 100)
  assert.equal(evaluateVisual(assertions, ['68px', 5]).score, 50)
  assert.equal(evaluateVisual(assertions, ['12px', 5]).score, 0)
})

test('the probe script targets the declared url and viewport', () => {
  const spec = parseVisualSpec(['url: /contact', 'viewport: 768', 'count .x 1'])
  const script = buildProbeScript(spec, 'https://example.test')
  assert.match(script, /https:\/\/example\.test\/contact/)
  assert.match(script, /768/)
  assert.match(script, /getComputedStyle|querySelectorAll/)
})
```

- [x] **Step 2: Lancer le test pour vérifier qu'il échoue**

```bash
node --test tests/visual-evaluate.test.mjs
```

Attendu : `evaluateVisual is not a function`.

- [x] **Step 3: Écrire l'évaluation et la sonde**

Ajouter à `scripts/lib/visual.mjs` :

```javascript
const NUMERIC = /^(-?\d+(?:\.\d+)?)([a-z%]*)$/i

function holds(assertion, actual) {
  if (actual === null || actual === undefined) {
    return { ok: false, reason: `no element matched "${assertion.selector}"` }
  }

  if (assertion.kind === 'count') {
    const ok = Number(actual) === assertion.expected
    return { ok, reason: ok ? null : `expected ${assertion.expected}, got ${actual}` }
  }

  const expected = String(assertion.expected).match(NUMERIC)
  const measured = String(actual).match(NUMERIC)

  if (expected && measured && expected[2] === measured[2]) {
    const tolerance = assertion.tolerance ?? 0
    const ok = Math.abs(Number(measured[1]) - Number(expected[1])) <= tolerance
    return { ok, reason: ok ? null : `expected ${assertion.expected}, got ${actual}` }
  }

  const ok = String(actual) === String(assertion.expected)
  return { ok, reason: ok ? null : `expected ${assertion.expected}, got ${actual}` }
}

export function evaluateVisual(assertions, measured) {
  const failures = []

  assertions.forEach((assertion, index) => {
    const { ok, reason } = holds(assertion, measured[index])
    if (!ok) {
      failures.push({
        selector: assertion.selector,
        property: assertion.property ?? 'count',
        message: `${assertion.selector} ${assertion.property ?? 'count'}: ${reason}`,
      })
    }
  })

  const passed = assertions.length - failures.length
  return { score: Math.round((100 * passed) / assertions.length), failures }
}

export function buildProbeScript(spec, baseUrl) {
  const target = new URL(spec.url, baseUrl).toString()
  const probes = spec.assertions.map((a) =>
    a.kind === 'count'
      ? { kind: 'count', selector: a.selector }
      : { kind: 'style', selector: a.selector, property: a.property },
  )

  return `const page = await browser.getPage("idd-visual");
await page.setViewportSize({ width: ${spec.viewport}, height: 900 });
await page.goto(${JSON.stringify(target)}, { waitUntil: "networkidle" });
const probes = ${JSON.stringify(probes)};
const measured = await page.evaluate((probes) => probes.map((probe) => {
  if (probe.kind === "count") return document.querySelectorAll(probe.selector).length;
  const el = document.querySelector(probe.selector);
  if (!el) return null;
  return getComputedStyle(el).getPropertyValue(probe.property).trim();
}), probes);
console.log(JSON.stringify({ url: ${JSON.stringify(target)}, measured }));
`
}
```

- [x] **Step 4: Écrire le CLI**

Créer `scripts/visual-cli.mjs` :

```javascript
#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { parseVisualSpec, buildProbeScript, evaluateVisual } from './lib/visual.mjs'

const [linesJson, baseUrl] = process.argv.slice(2)
if (!linesJson || !baseUrl) {
  console.error('usage: visual-cli.mjs <assertionLinesJson> <baseUrl>')
  process.exit(2)
}

const spec = parseVisualSpec(JSON.parse(linesJson))
const script = buildProbeScript(spec, baseUrl)

let output
try {
  output = execFileSync('dev-browser', ['--ignore-https-errors', '--headless', '--timeout', '30'], {
    input: script,
    encoding: 'utf8',
  })
} catch (error) {
  // The dev stack could not be probed. That is an infrastructure failure, not
  // a failing implementation — the evaluator must report UNKNOWN, never 0.
  console.log(JSON.stringify({ score: 'UNKNOWN', failures: [], error: String(error.stderr ?? error.message).trim() }))
  process.exit(0)
}

const { measured } = JSON.parse(output.trim().split('\n').at(-1))
console.log(JSON.stringify(evaluateVisual(spec.assertions, measured)))
```

Le `catch` est le point important : une pile de dev injoignable rend `UNKNOWN`,
que le calcul de verdict traduit en `BLOCK`. Rendre 0 ferait boucler l'agent
sur du code qui n'est pas en cause.

- [x] **Step 5: Lancer les tests**

```bash
node --test
```

Attendu : les 9 nouveaux tests passent.

- [x] **Step 6: Commit**

```bash
git add scripts/lib/visual.mjs scripts/visual-cli.mjs tests/visual-evaluate.test.mjs
git commit -m "feat: evaluate measured values and probe the page through dev-browser"
```

---

### Task 4: La skill, le câblage et l'activation

**Files:**
- Create: `skills/visual-verification/SKILL.md`
- Modify: `agents/evaluator.md`, `commands/idd/apply.md`, `scripts/lib/promote-schema.mjs`
- Modify: `tests/skills-conformance.test.mjs`, `tests/promote-schema.test.mjs`, `tests/evaluator-contract.test.mjs`

**Interfaces:**
- Consumes: `visual-cli.mjs` (Task 3)
- Produces: la dimension `visual` réellement évaluable, et activée par défaut.

- [x] **Step 1: Écrire les tests qui échouent**

Dans `tests/skills-conformance.test.mjs`, ajouter `'visual-verification'` à la liste `EXPECTED`.

Dans `tests/promote-schema.test.mjs`, rebasculer l'assertion :

```javascript
  assert.equal(config.verification.visual, true)
```

Dans `tests/evaluator-contract.test.mjs`, ajouter :

```javascript
test('the evaluator probes the page through the CLI rather than by eye', () => {
  const body = readFileSync(agentPath, 'utf8')
  assert.match(body, /visual-cli\.mjs/)
  assert.match(body, /UNKNOWN/, 'an unreachable dev stack must be UNKNOWN, not 0')
})
```

- [x] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

```bash
node --test
```

Attendu : trois échecs — skill absente, `visual` encore à `false`, évaluateur ne citant pas le CLI.

- [x] **Step 3: Écrire la skill**

Créer `skills/visual-verification/SKILL.md` :

```markdown
---
name: visual-verification
description: Use when writing or evaluating a VISUAL task in an idd-claude change - declaring measured dev-browser assertions against a rendered page, rather than eyeballing a screenshot.
---

# Visual Verification

A `VISUAL` task declares measurements, not impressions. It passes or fails on
values read from the rendered page, so it can gate a change the way a test
does.

## Format

```
- [ ] 3.4 VISUAL — Hero block
      url: /
      viewport: 1440
      assert .hero__title  font-size      68px
      assert .hero         padding-block  224px ±1
      count  .hero .layout-section > *    12
```

- `url:` is required, relative to the project's dev stack.
- `viewport:` defaults to 1440.
- `assert <selector>  <property>  <expected> [±tolerance]` reads
  `getComputedStyle(el).getPropertyValue(property)`.
- `count <selector>  <n>` compares `querySelectorAll(selector).length`.
- Separators are **two spaces or more**, so CSS selectors may contain spaces.

Nothing else is accepted. A line the parser does not recognise is an error,
not a comment — a silently ignored assertion is worse than no assertion.

## Where the expected values come from

Read them off the mockup and write them into the task when the tasks artifact
is generated. Do not extract them from Figma at evaluation time: that would put
a network dependency inside the gate.

## Why measurements rather than a screenshot

A screenshot cannot fail. The measured form catches what a glance does not —
a Tailwind utility neutralised by a token reset renders as a plain full-width
element with no error and no warning, and only a width assertion reveals it.

Screenshots are still produced and attached to the report as evidence. They are
never the criterion.

## Running one

`node "${CLAUDE_PLUGIN_ROOT}/scripts/visual-cli.mjs" '<lines as JSON array>' <baseUrl>`

It prints `{score, failures}`, or `{score: "UNKNOWN"}` when the dev stack could
not be reached. UNKNOWN is not zero: an unreachable stack is an infrastructure
failure and must block, not send the implementation round the retry loop.

## Worktrees

The dev stack must serve the worktree, not the main checkout. That is free with
a dev server started from an arbitrary directory, and impossible with a
single-docroot stack such as DDEV — there, work in place and say why.
```

- [x] **Step 4: Câbler l'évaluateur**

Dans `agents/evaluator.md`, remplacer l'étape 5 par :

```markdown
5. **Score `visual`** if the dimension is enabled: for every VISUAL task in the
   group, **re-run** its assertions yourself — never read the result the
   implementation session claimed. For each task, pass its assertion lines to:

   `node "${CLAUDE_PLUGIN_ROOT}/scripts/visual-cli.mjs" '<lines as JSON array>' <baseUrl>`

   The dimension's score is the mean of the per-task scores. If any invocation
   returns `"UNKNOWN"`, report `"UNKNOWN"` for the whole dimension — not 0. A
   broken environment is not a broken implementation.
```

- [x] **Step 5: Compléter le pré-contrôle d'apply**

Dans `commands/idd/apply.md`, préciser la première puce du pré-contrôle :

```markdown
- `visual: true` but `dev-browser` is not on PATH, or
  `project.dev_stack_command` is empty → stop, say which is missing.
```

- [x] **Step 6: Activer la dimension par défaut**

Dans `scripts/lib/promote-schema.mjs`, `defaultConfig()` :

```
  visual: true                 # dev-browser gate
```

- [x] **Step 7: Lancer les tests**

```bash
node --test
```

Attendu : toute la suite verte.

- [x] **Step 8: Commit**

```bash
git add skills/visual-verification/ agents/ commands/ scripts/ tests/
git commit -m "feat: visual-verification skill, evaluator wiring, dimension on by default"
```

---

## Auto-relecture

**Couverture de la spec.** Ce plan livre `/idd:explore` (dette du Plan 2) et la section « Gate visuel » de la spec dans son intégralité : format d'assertions mesurées, rejeu par l'évaluateur, screenshot comme pièce à conviction, UNKNOWN plutôt que 0 sur pile injoignable, valeurs attendues écrites en dur plutôt qu'extraites de Figma. **Reportés** : le mutation testing (Plan 4, avec la décision vitest) et spec-as-source (Plan 5).

**Une régression de conception rattrapée.** Le test « no command references a command that does not exist » n'était dans aucun plan : il est ajouté parce que le défaut qu'il attrape — `propose.md` renvoyant à une commande inexistante — a traversé tout le Plan 2 sans être vu. Un test vaut mieux qu'une intention de mieux relire.

**Types.** `parseVisualSpec` prend le tableau `lines` que `parseTasks` attache déjà à chaque tâche, ce qui évite un second format intermédiaire. `evaluateVisual(assertions, measured)` prend deux tableaux parallèles ; `buildProbeScript` produit les sondes dans le même ordre, ce dont dépend cet alignement. `visual-cli.mjs` sort soit `{score: number, failures}` soit `{score: "UNKNOWN"}`, et c'est cette chaîne littérale que `computeVerdict` (Plan 2) traite déjà comme non évaluée.
