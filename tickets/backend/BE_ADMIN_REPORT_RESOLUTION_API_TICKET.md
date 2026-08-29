# Backend Ticket: Atomic Admin Report Resolution API

## Priority

Required before the Admin Content Reports screen enables destructive actions.

## Required endpoint

`POST /api/admin/reports/{reportId}/resolve`

Request:

```json
{
  "action": "DISMISS | DELETE_CONTENT_WARN | DELETE_CONTENT_SUSPEND_14D",
  "note": "Internal Admin reason"
}
```

Response: the updated report, target-content result, account suspension state when applicable, audit event ID, and notification status.

## Required behavior

- Admin authorization and report ownership of the target are checked server-side.
- `DISMISS` changes only the report state.
- `DELETE_CONTENT_WARN` removes the target content, records an audit event, and queues one warning notification.
- `DELETE_CONTENT_SUSPEND_14D` performs content removal and a 14-day suspension in one transaction, with one audit event per resulting state change.
- Requests are idempotent; retries return the persisted resolution and do not duplicate notifications or suspensions.
- Return `409` for already-resolved reports and invalid state transitions.
- Do not require the frontend to invent target author names, suspension dates, or audit rows.
