# idd-claude — design

**Date** : 2026-08-17
**Statut** : design validé, prêt pour le plan d'implémentation

## Contexte

[intent-driven-template](https://github.com/intent-driven-dev/intent-driven-template) est le plus abouti des ports OpenSpec + Superpowers examinés (107 ★, MIT, maintenu — dernier push 2026-08-16), mais il vise **OpenCode** et son intégration Superpowers se réduit à une déclaration de plugin dans `opencode.json`, sans câblage aux étapes. Deux alternatives ont été écartées : [superspec](https://github.com/danielhanold/superspec) (schéma OpenSpec seul, vérification purement documentaire, 3 mois sans commit) et [opsx-superpowers](https://github.com/austinxyz/opsx-superpowers) (bons gates mais 5 ★, dépôt mélangé à des projets personnels, aucun fichier LICENSE malgré un `plugin.json` annonçant MIT).

`idd-claude` est un **fork dur** d'intent-driven-template pour Claude Code, dont la valeur ajoutée est de rendre la phase d'implémentation **contrainte** par Superpowers plutôt que suggérée, et d'ajouter une vérification visuelle mesurable qu'aucun des trois n'a.

### Ce qui manque à l'amont, précisément

Le bloc `apply` du `schema.yaml` d'intent-driven contient ceci, en entier :

> *« Read context files, work through pending tasks, mark complete as you go. Pause if you hit blockers or need clarification. »*

Trois lignes de prose, aucune mention de test. C'est le trou que ce projet comble.

## Décisions de cadrage

| Question | Décision |
|---|---|
| Forme du livrable | Repo autonome embarquant **plugin Claude Code + schéma OpenSpec** |
| Contrainte sur Superpowers | **Gates durs + sous-agent évaluateur scoré** |
| Périmètre v1 | Toutes les briques amont, `spec-as-source` **optionnel et OFF par défaut** |
| Diagrammes | `c4-diagrams` (Mermaid) pour les artefacts ; `diagram-design` reste un plugin séparé pour les livrables de communication |
| Vérification visuelle | **Ajout** : gate dev-browser à assertions mesurées |
| Stack v1 | JavaScript/TypeScript ; PHP en v2 |
| Rapport à l'amont | Fork dur, Claude Code uniquement — `.opencode/` et `opencode.json` supprimés |
| Distribution du schéma | Plugin porteur + commande de promotion (modèle opsx), migration possible vers les *stores* OpenSpec quand ils sortiront de beta |

**Prérequis** : OpenSpec doit passer de 1.2.0 (version installée) à ≥ 1.9.0. En 1.2.0 la commande `schema` est encore marquée `[experimental]` et `store` / `workset` n'existent pas.

## Architecture

```
idd-claude/
├── .claude-plugin/
│   ├── plugin.json              nom, version — pilote l'alerte de dérive de schéma
│   └── marketplace.json
├── commands/idd/
│   ├── init.md                  promeut le schéma + écrit openspec/config.yaml
│   ├── explore.md  propose.md  apply.md  verify.md
│   └── continue.md  sync.md  archive.md
├── skills/
│   ├── spec-as-source/  gherkin-authoring/  acceptance-test-authoring/
│   ├── architectural-decision-records/  glossary/  grill-me/
│   ├── adversarial-authoring/  openspec-git-discipline/  c4-diagrams/
│   └── visual-verification/     ← neuf
├── agents/
│   ├── evaluator.md             ← neuf
│   └── adversarial-author.md  adversarial-reviewer.md
├── schema/                      copie de référence : schema.yaml + templates/*.md
└── scripts/                     extracteurs Gherkin (pack js), runner d'assertions visuelles
```

La structure est validée contre les plugins installés localement : le plugin `vercel` embarque `agents/`, `commands/`, `skills/`, `hooks/` et `scripts/`, donc tout tient dans un seul plugin.

Le portage des skills amont est une copie : leur frontmatter `name` + `description` est déjà au format attendu par Claude Code. Le travail neuf tient en quatre pièces : les 8 commandes, `agents/evaluator.md`, `skills/visual-verification/`, et la logique de promotion du schéma dans `init.md`.

### Dégradation acceptée par rapport à l'amont

La revue adversariale de l'amont fait tourner l'auteur et le relecteur sur des **familles de modèles différentes** (`opencode/big-pickle` vs `openai/gpt-5.5`). Claude Code ne route que vers des modèles Anthropic : il reste un second regard, sans la diversité de famille qui en faisait l'intérêt principal. Conservé malgré tout, avec cette limite documentée.

## Pipeline d'artefacts

Graphe repris tel quel de l'amont, plus un nœud :

```
proposal ─┬────────────────────> specs ──┐
          │                               ├──> tasks ──> apply ──> verification ──> archive
          └──> design ──> adr ───────────┘
```

| Artefact | Skills branchées via `rules:` |
|---|---|
| `proposal` | `grill-me`, `glossary`, `adversarial-authoring` |
| `specs` | `spec-as-source` si `verification.spec_as_source: true` |
| `design` | `c4-diagrams` (sortie Mermaid) |
| `adr` | `architectural-decision-records` |
| `tasks` | `spec-as-source` (ordonnancement acceptance-first) sinon gabarit standard |
| `apply` | gates durs — voir ci-dessous |
| `verification` | l'évaluateur |

`verification` est un **artefact neuf**, pas une simple commande : il produit un `verification.md` (verdict + journal des itérations), visible dans `openspec status` et relisible en PR au même titre que la spec.

**Limite assumée** : les dépendances `requires:` du schéma gouvernent la création des artefacts, mais `archive` est une commande CLI, pas un nœud du graphe. Le blocage de l'archivage tant que `verification` n'est pas au vert est un contrôle dans `/idd:archive`, contournable en appelant `openspec archive` directement. C'est un garde-fou, pas une serrure.

## Phase apply

### Typage des tâches

Le mot-clé qui suit l'ordinal décide du traitement — jamais l'ordinal lui-même.

| Mot-clé | Traitement |
|---|---|
| `RED` | écrire le test, le lancer, confirmer que le mode d'échec correspond à la description |
| `GREEN` | code minimal, test au vert |
| `REFACTOR` | nettoyage à comportement constant, tests restent verts — **une tâche en fin de groupe**. Contrôle déterministe : le diff d'une tâche `REFACTOR` ne doit modifier **aucune assertion de test** ; s'il en modifie une, le comportement a changé sous couvert de nettoyage et l'évaluateur rend `RETRY` |
| `VISUAL` | vérification dev-browser mesurée |
| `FIX` | correction issue d'une itération d'évaluation |
| `ACCEPT` | scénario Gherkin — présent uniquement si `spec_as_source: true` |

`REFACTOR` est absent du typage d'opsx dont ce modèle dérive ; il est ajouté ici parce que la skill `superpowers:test-driven-development` est explicitement Red-Green-Refactor (son graphe boucle `green → refactor → re-vérifier green`) et qu'un refactoring non enregistré dans l'artefact n'est pas contrôlable.

Granularité retenue : **une tâche `REFACTOR` par groupe**, juste avant l'évaluateur, plutôt qu'une par paire RED/GREEN. Refactorer à l'échelle d'un ensemble de changements liés a plus de sens qu'après trois lignes de code minimal, et `tasks.md` ne triple pas. Le refactoring micro continue d'avoir lieu en session ; celui qui est enregistré et audité est celui du groupe.

### Ce qui force le TDD

1. `superpowers:test-driven-development` est invoquée obligatoirement à l'ouverture de la session apply — elle tient le « pas de GREEN sans RED précédent » pendant toute la session.
2. Le gabarit `tasks.md` génère les paires RED/GREEN dès la phase `tasks`, donc l'ordre est inscrit dans l'artefact avant qu'une ligne de code existe.
3. L'évaluateur contrôle a posteriori que **chaque GREEN s'accompagne d'une modification de fichier de test dans le diff du groupe**.

Le critère 3 porte sur le diff et non sur l'ordre des commits : la convention du template étant « red → green → commit », l'historique git ne distingue pas les deux temps.

### Couche multi-agent

| Skill | Rôle |
|---|---|
| `using-git-worktrees` | espace isolé pour l'implémentation |
| `subagent-driven-development` | un sous-agent par tâche, la session principale orchestre |
| `dispatching-parallel-agents` | groupes de tâches réellement indépendants |
| `verification-before-completion` | passe finale avant clôture |

Trois boucles imbriquées : revue légère *par tâche* (intégrée à `subagent-driven-development`), évaluateur externe *par groupe*, `verification-before-completion` *en fin de changement*.

Règle reprise d'opsx pour éviter de payer deux fois la même revue : **ne jamais invoquer `requesting-code-review` directement pendant apply** — c'est l'évaluateur qui le fait en interne.

Repli documenté : si les sous-agents sont indisponibles, `superpowers:executing-plans` prend le relais, mais **elle n'active transitivement ni le TDD ni la revue**. Dans ce mode, les gates doivent être invoqués explicitement — à écrire dans la commande, faute de quoi le mode dégradé perd silencieusement l'ensemble du dispositif.

### L'évaluateur

Sous-agent isolé recevant **uniquement** le contrat du groupe, les specs et le diff du groupe — jamais la conversation d'implémentation.

Enchaînement : `requesting-code-review` d'abord — sur un finding CRITICAL ou HIGH il retourne `BLOCK` sans noter ; sinon suite de tests, puis check visuel, puis notation.

L'évaluateur **rejoue lui-même** les assertions déclarées dans les tâches `VISUAL` du groupe : il ne lit pas le résultat annoncé par la session d'implémentation. C'est cohérent avec son rôle de vérificateur externe sceptique — il ne prend rien pour argent comptant, y compris une case cochée.

Modèle : **sonnet par défaut**, configurable. Écart assumé avec opsx, qui utilise haiku — économiser sur l'étape qui sert de garde-fou est le mauvais arbitrage.

Les dimensions notées sont activées dynamiquement par la configuration, et les poids renormalisés à 100 quand une dimension est désactivée.

### Gate visuel

Une tâche `VISUAL` déclare des assertions mesurables, évaluées par dev-browser via `getComputedStyle` / `getBoundingClientRect` :

```
- [ ] 3.4 VISUAL — bloc Hero sur /
      viewport: 1440
      assert  .hero .layout-section   grid-template-columns  → 12 colonnes
      assert  .hero__title            font-size              → 68px (±1)
      assert  .hero                   padding-block          → 224px
```

Le screenshot est produit et joint au rapport comme **pièce à conviction, jamais comme critère**. Un checkpoint humain subsiste en fin de groupe.

Ce choix distingue ce gate du « eyeball the rendered UI against the mock » d'opsx, qui ne peut pas échouer. Une assertion mesurée attrape ce qu'un coup d'œil laisse passer — par exemple un utilitaire Tailwind neutralisé par un reset de token, qui ne produit ni erreur ni avertissement.

**Origine des valeurs attendues** : écrites en dur dans `tasks.md` au moment de la génération des tâches en v1. L'extraction automatique depuis Figma est séduisante mais ajouterait une dépendance réseau dans le gate.

### Boucle de convergence

`PASS` → groupe suivant. `RETRY` → l'évaluateur écrit des tâches `FIX` et on reboucle. `BLOCK` → correction immédiate, sans notation. Plafond à 5 itérations, au-delà arrêt et remontée humaine.

## Configuration

État d'un projet après `/idd:init` :

```yaml
schema: idd-claude
stack: javascript              # javascript | php (v2)

verification:
  spec_as_source: false        # Gherkin exécutable — OFF par défaut
  visual: true                 # gate dev-browser
  subagents: true              # un sous-agent par tâche
  weights: { spec: 30, runtime: 30, visual: 20, code: 20, acceptance: 25 }
  threshold: 80
  max_iterations: 5
  evaluator_model: sonnet

project:
  dev_stack_command: "pnpm dev"
  test_commands: ["pnpm test"]

rules:                          # règles projet en texte libre (mécanisme amont)
  design:
    - Must use c4-diagrams skill
```

`verification.spec_as_source` est **la** source de vérité de l'activation. L'amont exprime cette activation par une ligne de prose commentée dans `rules:` (`# - Must use spec-as-source skill`), ce qui suffit à orienter la rédaction mais pas à faire brancher un évaluateur. Ici la commande lit le booléen, branche dessus, et injecte elle-même la consigne dans le prompt de l'artefact — un seul interrupteur, pas de dérive possible entre deux déclarations.

## Dégradations

| Situation | Comportement |
|---|---|
| OpenSpec absent ou < 1.9 | `/idd:init` refuse, affiche la commande de mise à jour |
| Superpowers absent | refus de démarrer apply |
| `visual: true` mais dev-browser absent | **refus de démarrer** |
| Serveur de dev ne monte pas | dimension visuelle = `UNKNOWN`, verdict `BLOCK` (infra), jamais `RETRY` (code) |
| Schéma promu ≠ version du plugin | avertissement à chaque commande `/idd:*`, avec la commande de correction |
| 5 itérations atteintes | arrêt, rapport, remontée humaine |

Principe directeur : **un `PASS` obtenu en sautant une dimension est pire qu'un échec**, parce qu'il ment. Une dimension activée mais non évaluable arrête la machine.

## Stratégie de test

- **Parties scriptées** (extracteur Gherkin, promotion du schéma, runner d'assertions dev-browser) : vrai code, vrais tests unitaires, écrits en TDD. Le projet s'applique à lui-même ce qu'il impose.
- **Schéma** : `openspec validate` sur un projet fixture.
- **Commandes et skills** : ce sont des prompts, non testables unitairement. Validation par un **projet fixture JS jouet** sur lequel on déroule un changement complet `propose → apply → verify → archive`, en vérifiant les artefacts produits et les verdicts rendus. C'est le pattern de Superpowers lui-même, dont le dossier `tests/` couvre son serveur JS et non ses skills.

## Hors périmètre v1

| Écarté | Déclencheur de reconsidération |
|---|---|
| Pack PHP / Behat | une fois la mécanique éprouvée sur un projet JS |
| Migration vers les *stores* OpenSpec | sortie de beta |
| Diff de screenshots contre baseline | si les assertions mesurées se révèlent insuffisantes |
| Extraction automatique des valeurs attendues depuis Figma | si la saisie manuelle devient le goulot |

## Risques connus

**Coût en jetons.** Un sous-agent par tâche plus un évaluateur par groupe : sur un changement de 25 tâches en 5 groupes, une trentaine de sessions d'agent. Le drapeau `subagents: false` permet de basculer les petits changements en mode direct avec gates explicites.

**Worktree contre gate visuel.** La vérification visuelle exige que le serveur de dev serve *le worktree*, pas le répertoire principal. Trivial en JS (Vite se lance depuis n'importe quel répertoire), impossible tel quel avec DDEV qui sert un docroot unique. Contrainte à traiter en même temps que le pack PHP : soit désactiver les worktrees, soit prévoir un montage dédié.

**Dérive de version du schéma.** Le modèle « plugin porteur + promotion » impose de re-promouvoir le schéma dans chaque projet après chaque mise à jour du plugin. Atténué par l'avertissement de dérive, supprimé le jour où les *stores* sortent de beta.

**Suivi de l'amont.** Le fork dur assume de ne pas rejouer les améliorations d'intent-driven-template. La divergence est massive dès le départ (gates durs, évaluateur, gate visuel), ce qui rend un merge amont illusoire de toute façon.
