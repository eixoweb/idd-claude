## ADDED Requirements

### Requirement: The assertion parser rejects malformed lines

The parser SHALL accept a directive only in its exact declared form, and SHALL
reject any line that deviates from it.

#### Scenario: Anchoring is enforced
- **WHEN** a directive carries leading or trailing content beyond its form
- **THEN** the parser raises an unrecognised-line error

#### Scenario: The two-space separator is required
- **WHEN** an assert or count line separates its fields with a single space
- **THEN** the parser raises an unrecognised-line error

#### Scenario: A viewport must be numeric
- **WHEN** a viewport line carries a non-numeric value
- **THEN** the parser raises an unrecognised-line error

### Requirement: A failure names both values

An assertion failure SHALL report the expected value and the measured value, so
the message alone is enough to act on.

#### Scenario: A style mismatch names both
- **WHEN** a style assertion does not hold
- **THEN** the message contains the expected value and the measured value

#### Scenario: A count mismatch names both
- **WHEN** a count assertion does not hold
- **THEN** the message contains the expected count and the measured count

### Requirement: The probe matches the assertion kind

The probe built for the page SHALL request a computed style for a style
assertion and an element count for a count assertion, and SHALL preserve the
order of the assertions.

#### Scenario: Each kind produces its own probe
- **WHEN** a spec mixes style and count assertions
- **THEN** the probe describes each with its own kind, in the declared order
