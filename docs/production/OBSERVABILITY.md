# WaanOfii — Observability, Health Probes & Monitoring

## 1. Health Probe Endpoints

WaanOfii exposes three distinct health check endpoints mounted under `/api/v1/health`:

| Endpoint | Purpose | Target / Use Case | Status Codes |
|---|---|---|---|
| `GET /api/v1/health/live` | **Liveness Probe** | Kubernetes / ECS process liveness check. Confirms event loop is responsive. | `200 OK` |
| `GET /api/v1/health/ready` | **Readiness Probe** | Load balancer traffic routing check. Tests active PostgreSQL connection and latency. | `200 OK` (Healthy), `503 Service Unavailable` (DB Down) |
| `GET /api/v1/health` | **Consolidated Health** | System status dashboard reporting uptime, memory (RSS/Heap), and database ping. | `200 OK`, `503 Service Unavailable` |

### 1.1 Sample Readiness Response
```json
{
  "status": "ready",
  "timestamp": "2026-10-02T06:00:00.000Z",
  "uptimeSeconds": 3450,
  "dependencies": {
    "database": {
      "status": "UP",
      "latencyMs": 2
    }
  }
}
```

---

## 2. Distributed Tracing & Correlation IDs

1. **Header Convention**: All incoming requests receive or inherit an `x-correlation-id` header (UUIDv4).
2. **Propagation**: The correlation ID is attached to the request context via `CorrelationIdMiddleware`, logged in structured log outputs, and returned in all response headers and error envelopes.
3. **Log Structure**:
   ```
   [Nest] 15708 - 10/02/2026, 6:00:00 AM LOG [PaymentsService] [corr-4a7f0525] Initiated payment order for membership mem-123
   ```

---

## 3. Security-Concealed Error Handling

The global `HttpExceptionFilter` intercepts all unhandled errors:
* **Production Error Masking**: Stack traces and internal database schemas are never returned to client responses. Instead, clients receive a generic error response with the `correlationId` for support lookups.
* **Database Details Redacted**: Raw SQL queries, table names, and foreign key details are strictly excluded from client response payloads.
* **Consistent Payload**:
  ```json
  {
    "success": false,
    "statusCode": 500,
    "message": "An unexpected error occurred. Please contact system support.",
    "error": "InternalServerError",
    "meta": {
      "timestamp": "2026-10-02T06:00:00.000Z",
      "path": "/api/v1/payments/initiate",
      "correlationId": "4a7f0525-4c07-4228-a400-36a87754eb27"
    }
  }
  ```
