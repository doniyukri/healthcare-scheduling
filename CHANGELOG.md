# Changelog

All notable changes to this project are documented here. The project follows
[Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-11-09

### Added

- Separate NestJS GraphQL authentication and scheduling services with independent PostgreSQL databases.
- JWT registration, login, delegated token validation, rate limiting, and structured request logging.
- Customer, doctor, and appointment management with filtering, pagination, audit logging, and double-booking protection.
- Redis response caching with versioned invalidation, TTL jitter, negative caching, and graceful fallback.
- BullMQ-backed confirmation and cancellation emails processed by a dedicated notification worker and viewable in Mailpit.
- Docker Compose development stack with health checks, startup migrations, demo seeding, and a clinic staff interface.
- Automated unit, coverage, and live acceptance tests plus a chained Postman collection.
- Reviewer documentation for architecture, API use, operations, and testing.

[1.0.0]: https://github.com/doniyukri/healthcare-scheduling/releases/tag/v1.0.0
