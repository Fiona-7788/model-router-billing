# Mainline Bundle Spec

## ADDED Requirements

### Requirement: Publish 2 approved changes together
The application SHALL activate the exact bundled scope from one authoritative mainline commit.

#### Scenario: Atomic mainline activation
- **Given** all bundled changes are approved and merged to the remote default branch
- **When** the release coordinator publishes bundle deploy-full
- **Then** changed child releases activate together and unrelated resources remain unchanged
