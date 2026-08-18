# Tasks

## 1. What the parser rejects
- [ ] 1.1 Pin that anchoring is enforced on all four directives
- [ ] 1.2 Pin that the two-space separator is required
- [ ] 1.3 Pin that a viewport must be numeric

## 2. Failure messages and probe construction
- [ ] 2.1 Pin that a style failure names expected and measured
- [ ] 2.2 Pin that a count failure names expected and measured
- [ ] 2.3 Pin that each assertion kind produces its own probe, in order

## 3. Make the mutation dimension able to report at all
- [ ] 3.1 RED — chooseMutationScope decides between scoped, full and none
- [ ] 3.2 GREEN — implement it; mutation-cli passes --mutate rather than --since
- [ ] 3.3 RED — a source change plus test-only work elsewhere runs full
- [ ] 3.4 GREEN — decide the mode on whether the diff touches tests
