# Application Specification

This directory is the source of truth for this application's agreed behavior.

## Purpose

Record user-facing behavior, data rules, permissions, workflows, automations, and runtime contracts for this OpenXiangda application. Platform governance rules live in OpenXiangda skills and references, not in this application spec.

## Requirements

### Requirement: 初始部署：基础资源发布与前端部署
The application SHALL provide the approved "初始部署：基础资源发布与前端部署" behavior for the affected OpenXiangda resources.

#### Scenario: Main path
- **Given** an authorized user is using the affected application area
- **When** the user follows the approved 初始部署：基础资源发布与前端部署 workflow
- **Then** the application produces the expected business result without relying on mock data or frontend-only authorization
