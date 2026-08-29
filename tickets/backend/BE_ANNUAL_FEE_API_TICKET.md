# Backend Ticket: Annual Fee Management API

## Priority

Required for the Admin Annual Fees screen to display persisted production prices.

## Required endpoints

- `GET /api/AnnualFee`
- `GET /api/AnnualFee/{id}`
- `POST /api/AnnualFee`
- `PUT /api/AnnualFee/{id}`
- `PATCH /api/AnnualFee/{id}/toggle`
- `DELETE /api/AnnualFee/{id}`

## DTO

```json
{
  "id": 1,
  "targetRole": "Researcher",
  "title": "Researcher Annual Fee",
  "priceVnd": 990000,
  "billingCycle": "Annual",
  "features": ["..."],
  "isActive": true,
  "updatedAt": "2026-08-29T00:00:00Z"
}
```

Create/update requests must validate the role, positive VND amount, supported billing cycle, unique active tier per role/cycle, and feature list. All endpoints require Admin authorization. Payment and membership purchase flows must read the same persisted records; the client must not be able to alter price or entitlements during checkout.

## Acceptance tests

- Unauthorized roles receive `403`.
- Admin CRUD survives reload and returns the documented DTO.
- Invalid amounts, duplicate active tiers, and unsupported roles are rejected without partial writes.
- Deactivating a fee prevents new purchases but preserves historical purchase records.
- Swagger includes all schemas and error responses.
