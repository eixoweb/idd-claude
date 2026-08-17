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
not a comment — a silently ignored assertion is worse than no assertion. So is
a VISUAL task with no assertion at all: the parser rejects that too.

## Prose is not an assertion

Write `count .grid > *  12`, never "→ 12 columns". A count is checkable; a
sentence is not. If a property genuinely cannot be reduced to a measurement,
it does not belong in a VISUAL task — put it in the human checkpoint instead.

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

It prints `{score, failures}`, or `{score: "UNKNOWN", error}` when the dev
stack could not be reached. UNKNOWN is not zero: an unreachable stack is an
infrastructure failure and must block, not send the implementation round the
retry loop.

## Worktrees

The dev stack must serve the worktree, not the main checkout. That is free with
a dev server started from an arbitrary directory, and impossible with a
single-docroot stack such as DDEV — there, work in place and say why.
