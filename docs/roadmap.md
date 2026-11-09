# Roadmap and non-goals

Version 1.0.0 is a local, staff-facing technical-test delivery. The following items are deliberately excluded from its release contract; listing them here prevents production-hardening ideas from obscuring the required workflow.

## Reliability

- **Transactional outbox and replay UI:** Queue publication is currently best-effort after the schedule transaction. An outbox would provide guaranteed handoff and controlled replay at the cost of another state machine and retention policy.
- **Cross-region availability and replicas:** The Compose topology targets one local environment, not multi-region failover.
- **Automated backup orchestration:** Backup ownership depends on the production platform and its retention requirements.

## Access and healthcare governance

- **RBAC and tenant isolation:** v1.0.0 authenticates users but does not model clinic tenants or receptionist/doctor/admin roles. These must be designed before handling real patient data.
- **Consent, data residency, retention, and audit export:** Regulatory policy is deployment- and jurisdiction-specific and is not implied by this technical demonstration.
- **Soft deletion and archival:** The brief requires deletion behavior. Healthcare retention rules would require a product and compliance decision before replacing it.

## API evolution

- **GraphQL subscriptions:** The staff UI refreshes state through queries; real-time appointment updates need connection lifecycle and authorization design.
- **Cursor pagination:** Offset/page pagination is sufficient for the delivery scale. Cursor semantics should be introduced only with an API versioning plan.
- **Idempotency keys:** Create mutations currently rely on uniqueness and conflict handling, not client-provided retry keys.
- **Federation or an API gateway:** Two small, independently reachable services do not justify an additional runtime hop yet.

## Observability and deployment

- **OpenTelemetry and distributed tracing:** Request IDs and metrics cover the local system; tracing becomes valuable with a production collector and sampling policy.
- **Kubernetes/Helm and autoscaling:** Docker Compose is the supported v1.0.0 deployment model.
- **Sentry or hosted error tracking:** No external monitoring account is required for the assessment.
- **Prometheus/Grafana dashboards and SLOs:** Metrics endpoints are foundations; durable dashboards and alert thresholds need observed production traffic.

These are candidates for later minor or major releases, not promises. Security and correctness issues discovered in the shipped scope take priority over roadmap features.
