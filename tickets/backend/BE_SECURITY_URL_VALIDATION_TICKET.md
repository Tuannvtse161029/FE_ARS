# [SEC-BE-001] Backend URL Validation for Materials Fields

## Priority: HIGH

## Security Classification: Stored XSS via Malicious URL

## Date Opened
2026-09-12

## Status
**OPEN** — Requires BE team investigation and implementation

## Source
Security review of ARS_FE codebase (SEC-001 / VULN-001)  
Issue location: `src/components/lecturer/OpenTopicModal.tsx:164,182`, `src/components/lecturer/LearningMaterialModal.tsx:321`, `src/pages/Lecturer/GroupDetail.tsx:1035`, `src/features/guidance/components/MaterialsDisplay.tsx:72`, `src/pages/GraduateStudent/SubmitReport.tsx:394`, `src/components/gradstudent/PhaseReportDetailModal.tsx:159`, `src/features/guidance/components/WorkspaceView.tsx:214,344`, `src/pages/Lecturer/EvaluateReports.tsx:482`, `src/pages/Lecturer/LearningMaterials.tsx:627`, `src/pages/Admin/RoleRequestDetailsModal.tsx:143`, `src/pages/Admin/ViewProfileModal.tsx:989`, `src/components/profile/RequestAdditionalRoleModal.tsx:547`

## Issue Summary

The FE now applies `safeHref()` (http/https protocol allow-list via `new URL()` parsing) at render time to all `href` attributes that receive URLs from the BE. However, this is a defense-in-depth measure — the BE is the authoritative gate for data integrity.

If the BE does not independently reject non-HTTP(S) URLs in the following fields, an attacker with the Lecturer, Researcher, or Graduate Student role could inject malicious URLs (e.g. `javascript:alert(document.domain)`) into:

- `ResearchTopic.materialsUrl` — research topic reference materials
- `LearningMaterial.fileUrl` — learning material PDF URLs
- `SeminarPhaseReport.reportFileUrl` — phase report file URLs
- `RoleRequest.proofDocumentUrl` — role upgrade proof documents

A viewer (Lecturer, Admin) clicking such a link in their browser would execute the injected JavaScript in the context of the ARS origin, enabling session hijacking, data exfiltration, or phishing redirects.

## FE Mitigation Applied
`safeHref()` is now applied at every render site — if the BE returns a non-HTTP(S) URL, the `href` falls back to `#` (no-op). This closes the render-time gap but does not fix the root cause.

## Required BE Action

1. **Add server-side URL validation** for all `materialsUrl`, `fileUrl`, `reportFileUrl`, `proofDocumentUrl` fields across the following endpoints:
   - `POST /api/research-topics` (and `PUT /api/research-topics/{id}`)
   - `POST /api/learning-materials` (and `PUT`)
   - `POST /api/phased-reports` (and `PUT`)
   - `POST /api/role-requests`
   - Any other endpoint accepting file/URL fields

2. **Validation rule**: Reject any URL that does not start with `http://` or `https://`. Return HTTP 400 with a descriptive error (e.g. `"URL must use the https:// protocol"`).

3. **Firebase Storage URL acceptance**: Firebase Storage download URLs (e.g. `https://firebasestorage.googleapis.com/...`) are legitimate and must be allow-listed explicitly if the platform accepts Firebase URLs as valid.

## Test Cases

```bash
# Should return 400
curl -X POST /api/research-topics \
  -H "Content-Type: application/json" \
  -d '{"materialsUrl": "javascript:alert(1)"}'
# Expected: 400 Bad Request

# Should return 400
curl -X POST /api/learning-materials \
  -H "Content-Type: application/json" \
  -d '{"fileUrl": "data:text/html,<script>alert(1)</script>"}'
# Expected: 400 Bad Request

# Should return 400
curl -X POST /api/research-topics \
  -H "Content-Type: application/json" \
  -d '{"materialsUrl": "ftp://malicious-host.com/payload"}'
# Expected: 400 Bad Request

# Should return 200 (Firebase URLs are allowed)
curl -X POST /api/learning-materials \
  -H "Content-Type: application/json" \
  -d '{"fileUrl": "https://firebasestorage.googleapis.com/v0/b/ars-fe.appspot.com/o/materials%2Fsyllabus.pdf?alt=media"}'
# Expected: 200 OK (if other fields are valid)
```

## References

- OWASP A03:2021 Injection
- CWE-79: Cross-site Scripting (XSS)
- FE fix: `src/utils/validationRules.ts` — `safeHref()` function
