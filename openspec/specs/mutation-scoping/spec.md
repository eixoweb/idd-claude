# mutation-scoping Specification

## Purpose
TBD - created by archiving change strengthen-visual-tests. Update Purpose after archive.

## Requirements

### Requirement: The mutation run measures what the change affects

The mutation scope SHALL be chosen so that a change's own modules are measured,
and SHALL never silently exclude a module the change set out to strengthen.

#### Scenario: A changed test forces a full run
- **WHEN** the diff touches any test file
- **THEN** the run is not scoped, because a test's coverage cannot be derived
  from its path

#### Scenario: A pure source diff is scoped
- **WHEN** the diff touches source files and no test file
- **THEN** the run mutates exactly those source files

#### Scenario: A diff with nothing mutable reports UNKNOWN
- **WHEN** the diff touches neither a mutable source file nor a test
- **THEN** the score is UNKNOWN rather than a number
