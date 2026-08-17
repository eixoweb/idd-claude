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
