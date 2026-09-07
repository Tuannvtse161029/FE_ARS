# Avoid "Editorial" Terminology in ARS Platform

## Rule

The word "editorial" is academic jargon that confuses users. **Replace it with plain-language alternatives** that match what users actually experience.

## Approved Replacements

| Instead of | Use | Rationale |
|---|---|---|
| `Editorial Status` | `Review Status` or `Processing Status` | Describes where the paper is in the review pipeline |
| `Editorial record` | `Submission record` or `Paper record` | A record is a record — "editorial" adds nothing |
| `Editorial decision` | `Publication decision` or `Review decision` | Users understand "decision" without the jargon |
| `Editorial workflow` | `Review process` or `Submission workflow` | The workflow is about review, not "editing" |
| `Editorial section` (sidebar) | `Review section` or `Screening section` | Describes what the section contains |
| `editorial record` (button/link) | `submission record` | Lowercase, action-oriented |
| `Open editorial record` | `Open submission record` | Action + noun, no jargon |

## When "Editorial" Is Acceptable

- **CSS class names** that are internal and never shown to users (e.g., `.editorialDraft`)
- **Code comments** that explain the pipeline concept
- **Variable names** in TypeScript that are internal (e.g., `editorialStatus`)
- **Database/backend** field names that match the API contract

## Why This Matters

Users are researchers, lecturers, and graduate students — not publishing professionals. "Editorial" sounds like a newspaper term. "Review" accurately describes what the system does: peer review.

## Enforcement

When adding new i18n keys, UI labels, or user-facing copy:
- Search the existing codebase for "editorial" before introducing it
- If the word appears in a translation key, tooltip, button label, or description, replace it
- If uncertain, ask: "Would a first-time user understand this without a dictionary?"
