# MediCore Analytics Service

Port allocation: 8002
Architecture: Dedicated clinical analytics and reporting service.
Target batch: Batch 3.

## Notification sandbox limitation

MC-08 requires email/SMS sandbox notifications. MediCore uses a deterministic,
local sandbox worker: it validates recipient format, records successful sends,
retries failures, preserves idempotency, and places exhausted jobs in a DLQ.
It does not contact real email/SMS providers, send paid messages, or claim
external delivery. Production integrations require an evaluator-approved free
sandbox adapter with credentials supplied outside source control.
