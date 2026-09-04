# FE Ticket — Seminar Structured Feedback + AI Feedback Aggregation

## 1. Mục tiêu

Cập nhật FE Seminar để hỗ trợ flow feedback mới của BE:

```text
Participant
    ↓
Submit structured feedback
    ↓
SeminarParticipant.FeedbackJson
    ↓
Owner Lecturer/Researcher xem raw feedback
    ↓
Owner Generate AI Feedback Summary
    ↓
Gemini tổng hợp
    ↓
Seminar.feedback
```

Flow **Rating cũ đã bỏ hoàn toàn**.

FE không được gửi hoặc hiển thị:

```text
rating
averageScore
```

`participantEvaluation` hiện chỉ còn được BE giữ tạm để backward compatibility. **Code FE mới không dùng field này làm source of truth.**

---

## 2. Role / Permission

Hai role owner Seminar:

```text
Lecturer
Researcher
```

Cả hai có cùng quyền:

- Create Seminar
- Update Seminar
- Delete Seminar
- Invite participant
- View all participant feedback
- View Seminar stats
- Send feedback reminder
- Generate AI feedback summary
- Generate AI audio summary

Participant được mời:

- View Seminar được mời
- Submit feedback của chính mình
- Update feedback của chính mình
- View feedback của chính mình
- Không được xem raw feedback của participant khác

Quan trọng:

```text
Owner KHÔNG được submit/edit raw feedback thay participant.
```

Nếu owner gửi feedback qua participant Create/Update API, BE trả:

```text
403 Forbidden
```

FE không được tạo UI cho owner nhập feedback thay participant.

---

## 3. Structured Feedback Model

FE tạo type:

```ts
export interface SeminarFeedbackContent {
  overallComment?: string;
  strengths: string[];
  improvements: string[];
  suggestions: string[];
}
```

Payload submit:

```ts
export interface SeminarFeedbackRequest {
  feedback: SeminarFeedbackContent;
}
```

Ví dụ:

```json
{
  "feedback": {
    "overallComment": "Nội dung seminar hữu ích và dễ hiểu.",
    "strengths": [
      "Ví dụ thực tế rõ ràng",
      "Nội dung được trình bày logic"
    ],
    "improvements": [
      "Phần Q&A hơi ngắn"
    ],
    "suggestions": [
      "Nên cung cấp slide sau seminar"
    ]
  }
}
```

Không gửi:

```json
{
  "rating": 5
}
```

Không dùng payload mới kiểu:

```json
{
  "participantEvaluation": "..."
}
```

dù BE hiện vẫn hỗ trợ field này tạm thời.

---

## 4. Validation Feedback trên FE

Participant phải nhập **ít nhất một** trong:

- `overallComment`
- `strengths`
- `improvements`
- `suggestions`

Ví dụ hợp lệ:

```json
{
  "feedback": {
    "overallComment": "",
    "strengths": [
      "Diễn giả giải thích rõ"
    ],
    "improvements": [],
    "suggestions": []
  }
}
```

Object hoàn toàn rỗng phải disable submit / show validation:

```json
{
  "feedback": {
    "overallComment": "",
    "strengths": [],
    "improvements": [],
    "suggestions": []
  }
}
```

---

## 5. API Submit Feedback

API chính FE nên dùng:

```http
POST /api/Seminar/{seminarId}/feedback
```

Authorization:

```text
Bearer JWT
```

Body:

```json
{
  "feedback": {
    "overallComment": "Seminar rất hữu ích.",
    "strengths": [
      "Nội dung rõ ràng"
    ],
    "improvements": [
      "Q&A hơi ngắn"
    ],
    "suggestions": [
      "Nên gửi tài liệu tham khảo"
    ]
  }
}
```

Response:

```ts
export interface SeminarFeedbackResponse {
  seminarId: number;
  seminarParticipantId: number;
  userId?: number | null;
  feedback: SeminarFeedbackContent;

  // Legacy compatibility, FE mới không cần dùng.
  participantEvaluation?: string | null;

  feedbackSubmittedAt: string;
  feedbackUpdatedAt?: string | null;
  invitationStatus: string;
  message: string;
}
```

FE nên dùng:

```text
feedback
feedbackSubmittedAt
feedbackUpdatedAt
```

Không dùng `participantEvaluation`.

---

## 6. API Compatibility khác

BE hiện còn hai route tương đương:

```http
POST /api/SeminarParticipant/{seminarId}/feedback
POST /api/SeminarParticipant/feedback/{seminarId}
```

Nhưng FE nên thống nhất dùng duy nhất:

```http
POST /api/Seminar/{seminarId}/feedback
```

để tránh duplicate service method phía FE.

---

## 7. Participant xem Seminar của mình

Có thể dùng:

```http
GET /api/Seminar/my-invitations
```

hoặc flow hiện tại:

```http
GET /api/SeminarParticipant/my-seminars
```

Response participant có:

```ts
feedback?: SeminarFeedbackContent | null;
feedbackSubmittedAt?: string | null;
feedbackUpdatedAt?: string | null;
```

Type gợi ý:

```ts
export interface SeminarInvitation {
  seminarId: number;
  seminarParticipantId: number;
  title: string;
  startTime: string;
  endTime: string;
  onlineLink?: string | null;
  organizerName?: string | null;
  invitationStatus?: string | null;
  feedback?: SeminarFeedbackContent | null;
  feedbackSubmittedAt?: string | null;
  feedbackUpdatedAt?: string | null;

  // Legacy only.
  participantEvaluation?: string | null;
}
```

Nếu:

```ts
feedback === null
```

hiển thị:

```text
Submit Feedback
```

Nếu đã có:

```ts
feedback !== null
```

hiển thị:

```text
View / Edit Feedback
```

---

## 8. Edit Feedback

Không cần API mới.

Participant submit lại:

```http
POST /api/Seminar/{seminarId}/feedback
```

BE update cùng một participant record:

```text
FeedbackJson          overwrite
FeedbackSubmittedAt   giữ lần submit đầu
FeedbackUpdatedAt     cập nhật lần gần nhất
```

Sau lần submit đầu FE đổi button:

```text
Submit Feedback
```

thành:

```text
Edit Feedback
```

Khi mở form Edit phải prefill từ `feedback` hiện tại.

---

## 9. Không dùng InvitationStatus để xác định đã feedback

BE hiện vẫn set:

```text
InvitationStatus = SUBMITTED
```

sau feedback để giữ compatibility code cũ.

Nhưng FE mới **không được lấy đây làm source of truth**.

Không làm:

```ts
const hasSubmitted = invitationStatus === 'SUBMITTED';
```

Nên làm:

```ts
const hasSubmittedFeedback =
  feedback != null ||
  feedbackSubmittedAt != null;
```

Vì:

```text
InvitationStatus = invitation lifecycle
Feedback = feedback lifecycle
```

---

## 10. Owner xem Raw Feedback

API:

```http
GET /api/Seminar/{seminarId}/feedback
```

Role:

```text
Lecturer
Researcher
```

BE còn check:

```text
Seminar.OrganizerId == currentUserId
```

nên owner chỉ xem feedback Seminar của chính họ.

Response:

```ts
export interface SeminarParticipantResponse {
  seminarParticipantId: number;
  seminarId?: number | null;
  userId?: number | null;
  userFullName?: string | null;
  userEmail?: string | null;
  invitedEmail?: string | null;
  invitationStatus?: string | null;

  feedback?: SeminarFeedbackContent | null;

  feedbackSubmittedAt?: string | null;
  feedbackUpdatedAt?: string | null;
  invitationSentAt?: string | null;
  eventReminderSentAt?: string | null;
  feedbackReminderSentAt?: string | null;

  // Legacy compatibility only.
  participantEvaluation?: string | null;
}
```

Owner page nên render:

```text
Participant name / email

Overall Comment
...

Strengths
• ...
• ...

Areas for Improvement
• ...

Suggestions
• ...

Submitted at
Updated at
```

Không render Rating.

---

## 11. Participant Privacy

Khi participant gọi:

```http
GET /api/Seminar/{seminarId}
```

BE đã mask raw feedback của participant khác.

FE không nên có màn:

```text
All participant feedback
```

cho participant.

Màn raw feedback list chỉ hiển thị cho owner:

```ts
role === 'Lecturer' || role === 'Researcher'
```

và Seminar phải là Seminar do current user tổ chức.

---

## 12. Seminar Stats

API:

```http
GET /api/Seminar/{seminarId}/stats
```

Role:

```text
Lecturer
Researcher
```

Response mới:

```ts
export interface SeminarStats {
  seminarId: number;
  totalInvited: number;
  submitted: number;
  pending: number;
  declined: number;
  completionPercentage: number;
}
```

Ví dụ:

```json
{
  "seminarId": 12,
  "totalInvited": 10,
  "submitted": 6,
  "pending": 3,
  "declined": 1,
  "completionPercentage": 60
}
```

FE phải xóa:

```text
Average Score
Rating Average
Stars
/10 score
```

Không còn `averageScore`.

Stats UI mới:

```text
Total Invited: 10
Submitted Feedback: 6
Pending Feedback: 3
Declined: 1
Completion: 60%
```

---

## 13. Send Feedback Reminder

API:

```http
POST /api/Seminar/{seminarId}/reminders/send
```

Role:

```text
Lecturer
Researcher
```

BE chỉ gửi cho:

```text
not DECLINED
AND chưa có FeedbackJson
AND chưa từng được gửi Feedback Reminder
```

Response gợi ý:

```ts
export interface SeminarReminderResponse {
  seminarId: number;
  eligible: number;
  sent: number;
  skipped: number;
  failedEmails: string[];
}
```

Sau success có thể toast:

```text
Feedback reminder sent to {sent} participant(s).
```

---

## 14. AI Feedback Summary — API mới

Owner action:

```text
Generate AI Feedback Summary
```

API:

```http
POST /api/Seminar/{seminarId}/summarize-feedback
```

Role:

```text
Lecturer
Researcher
```

Không có request body.

Ví dụ:

```ts
await api.post(
  `/api/Seminar/${seminarId}/summarize-feedback`
);
```

Response:

```ts
export interface SeminarFeedbackAiSummary {
  seminarId: number;
  feedbackCount: number;
  feedback: {
    overallAssessment: string;
    commonStrengths: string[];
    areasForImprovement: string[];
    commonSuggestions: string[];
    conflictingFeedback: string[];
    recommendedActions: string[];
  };
  generatedAt: string;
}
```

Ví dụ response:

```json
{
  "seminarId": 12,
  "feedbackCount": 6,
  "feedback": {
    "overallAssessment": "Người tham dự nhìn chung đánh giá tích cực...",
    "commonStrengths": [
      "Nội dung rõ ràng",
      "Ví dụ có tính ứng dụng"
    ],
    "areasForImprovement": [
      "Phần Q&A cần nhiều thời gian hơn"
    ],
    "commonSuggestions": [
      "Cung cấp slide sau seminar"
    ],
    "conflictingFeedback": [
      "Ý kiến về tốc độ trình bày chưa thống nhất"
    ],
    "recommendedActions": [
      "Tăng thời gian Q&A",
      "Gửi tài liệu tham khảo sau buổi Seminar"
    ]
  },
  "generatedAt": "2026-09-04T03:20:00Z"
}
```

---

## 15. UX khi Generate AI Feedback

Owner page nên có section:

```text
Participant Feedback
--------------------
6 / 10 submitted

[Send Reminder]
[Generate AI Summary]
```

Khi gọi AI:

```text
disable button
show loading
```

Ví dụ:

```text
Generating AI feedback summary...
```

Không cho double-click spam API.

Sau success:

```text
render response immediately
refetch Seminar detail
```

---

## 16. Khi chưa có Feedback

Nếu owner bấm Generate nhưng chưa participant nào feedback, BE trả `400`.

Response:

```json
{
  "message": "Seminar chưa có feedback để tổng hợp."
}
```

FE show message từ BE.

---

## 17. Gemini/API lỗi

Nếu Gemini thất bại, endpoint có thể trả:

```text
502 Bad Gateway
```

Body:

```json
{
  "message": "..."
}
```

FE cần:

```text
stop loading
show error toast/message
không xóa AI feedback cũ nếu trước đó đã có
```

Ưu tiên message:

```ts
error.response?.data?.message
```

rồi mới fallback generic message.

---

## 18. AI Feedback được lưu trong Seminar

Sau khi generate:

```text
Seminar.feedback
Seminar.aiFeedbackGeneratedAt
```

được cập nhật.

`GET /api/Seminar/{id}` có:

```ts
feedback?: string | null;
aiFeedbackGeneratedAt?: string | null;
```

Lưu ý: `feedback` trong `SeminarResponse` hiện là **JSON string**, không phải object trực tiếp.

FE nên parse:

```ts
export interface SeminarFeedbackAiContent {
  overallAssessment: string;
  commonStrengths: string[];
  areasForImprovement: string[];
  commonSuggestions: string[];
  conflictingFeedback: string[];
  recommendedActions: string[];
}

export const parseAiFeedback = (
  value?: string | null
): SeminarFeedbackAiContent | null => {
  if (!value) return null;

  try {
    return JSON.parse(value) as SeminarFeedbackAiContent;
  } catch {
    return null;
  }
};
```

Không render raw JSON string.

---

## 19. AI Audio Summary và AI Feedback Summary là hai feature khác nhau

Không trộn:

```text
aiSummary
```

với:

```text
feedback
```

### Audio AI

```text
Upload audio/video
      ↓
Gemini
      ↓
seminar.aiSummary
```

UI:

```text
AI Seminar Summary
```

### Feedback AI

```text
Participant feedbacks
      ↓
Gemini
      ↓
seminar.feedback
```

UI:

```text
AI Feedback Analysis
```

Hai action riêng:

```text
Upload / Generate Audio Summary
Generate Feedback Summary
```

---

## 20. Regenerate AI Feedback

API hiện tại không cần `replaceExisting`.

Owner gọi lại:

```http
POST /api/Seminar/{id}/summarize-feedback
```

BE lấy toàn bộ feedback mới nhất và overwrite:

```text
Seminar.feedback
AiFeedbackGeneratedAt
```

FE có thể đổi button:

Lần đầu:

```text
Generate AI Feedback Summary
```

Sau khi đã có:

```text
Regenerate AI Feedback Summary
```

Nên có confirm:

```text
A new AI summary will replace the current feedback summary. Continue?
```

---

## 21. Feedback mới sau khi đã Generate AI

Ví dụ:

```text
09:00 AI summary generated
09:30 participant mới submit feedback
```

BE hiện không tự regenerate.

MVP:

```text
owner tự bấm Regenerate
```

Không cần tự động gọi Gemini.

---

## 22. Participant Create API — tuyệt đối không gửi Feedback

Owner API:

```http
POST /api/SeminarParticipant
```

Request chỉ nên gửi:

```json
{
  "seminarId": 12,
  "userId": 41,
  "invitedEmail": "user@example.com",
  "invitationStatus": "INVITED"
}
```

Không gửi:

```json
{
  "feedback": {
    "overallComment": "..."
  },
  "participantEvaluation": "..."
}
```

BE sẽ reject owner bằng:

```text
403
```

nếu owner cố tạo feedback thay participant.

---

## 23. Participant Update API

API:

```http
PUT /api/SeminarParticipant/{seminarParticipantId}
```

Owner có thể dùng cho invitation status:

```json
{
  "invitationStatus": "DECLINED"
}
```

Owner **không được gửi**:

```json
{
  "feedback": {
    "overallComment": "..."
  }
}
```

BE trả `403`.

Participant chính chủ có thể update feedback qua PUT để compatibility, nhưng FE mới nên ưu tiên:

```http
POST /api/Seminar/{seminarId}/feedback
```

Không cần xây hai flow submit khác nhau.

---

## 24. Owner Seminar List — Researcher Fix

Nếu FE hiện còn logic:

```ts
if (
  canMutateSeminar(currentRole) &&
  currentRole === 'Lecturer'
) {
  getAll();
} else {
  getMyInvitations();
}
```

phải sửa.

Logic đúng:

```ts
if (canMutateSeminar(currentRole)) {
  getAll();
}
```

Trong đó:

```ts
SEMINAR_MUTATOR_ROLES = [
  'Lecturer',
  'Researcher'
];
```

`GET /api/Seminar` đã được BE scope theo current organizer.

Researcher chỉ thấy Seminar do chính Researcher đó tạo.

---

## 25. Suggested Invitees

Owner vẫn dùng:

```http
GET /api/Seminar/suggested-invitees?subFieldId={subFieldId}
```

Không bị thay bởi feedback ticket.

FE không được xóa flow này khi refactor Seminar page.

---

## 26. Audio Summary vẫn giữ nguyên

Không sửa/remove:

```http
POST /api/Seminar/{id}/summarize-audio
```

Owner:

```text
Lecturer
Researcher
```

Feedback ticket chỉ bổ sung:

```http
POST /api/Seminar/{id}/summarize-feedback
```

Hai feature phải cùng tồn tại.

---

## 27. Suggested UI Structure

Không bắt buộc đổi folder nếu project đã có convention khác, nhưng trách nhiệm UI nên tách:

```text
Seminar Detail
├── Seminar Information
├── AI Audio Summary
├── Participant Feedback
│   ├── Feedback form             participant
│   ├── Feedback list             owner
│   ├── Stats                     owner
│   └── Send reminder             owner
└── AI Feedback Analysis          owner
```

Không trộn participant form với AI result.

---

## 28. API Service cần bổ sung

Ví dụ trong `seminarService`:

```ts
submitFeedback(
  seminarId: number,
  payload: SeminarFeedbackRequest
)

getFeedback(
  seminarId: number
)

getStats(
  seminarId: number
)

sendFeedbackReminders(
  seminarId: number
)

summarizeFeedback(
  seminarId: number
)
```

Reuse API instance/JWT handling hiện tại.

---

## 29. Loading / Error State

Nên có loading riêng:

```text
feedbackSubmitting
feedbackLoading
reminderSending
feedbackAiGenerating
```

Không dùng chung một `isLoading` khiến Audio Summary và Feedback block lẫn nhau.

Error ưu tiên:

```ts
error.response?.data?.message
```

---

## 30. Không làm trong Ticket này

Không sửa:

```text
Registration
ORCID
Reviewer
Paper
Forum
Premium
Wallet
```

Không refactor toàn Seminar UI ngoài phạm vi cần thiết.

Không thay API Audio Summary.

Không tạo client-side Rating mới.

Không dùng `participantEvaluation` làm model chính.

---

# Acceptance Criteria

- [ ] Lecturer và Researcher đều thấy Seminar mình tạo và có đầy đủ owner actions.
- [ ] Participant được mời có thể submit structured feedback gồm `overallComment`, `strengths`, `improvements`, `suggestions`.
- [ ] Feedback có thể edit bằng cách submit lại.
- [ ] FE không gửi `rating`.
- [ ] FE không hiển thị `averageScore`.
- [ ] FE mới không dùng `participantEvaluation` làm source of truth.
- [ ] Participant không thấy raw feedback của participant khác.
- [ ] Owner xem được raw feedback list.
- [ ] Owner không có UI nhập/sửa feedback thay participant.
- [ ] Owner gửi feedback reminder được.
- [ ] Stats hiển thị `totalInvited`, `submitted`, `pending`, `declined`, `completionPercentage`.
- [ ] Owner generate AI feedback bằng `POST /api/Seminar/{id}/summarize-feedback`.
- [ ] AI result render thành các section, không render raw JSON.
- [ ] Có loading state khi Gemini đang chạy.
- [ ] Có handling `400`, `403`, `404`, `502`.
- [ ] Regenerate AI feedback overwrite kết quả cũ.
- [ ] Audio Summary cũ vẫn hoạt động bình thường.
- [ ] Suggested Invitees cũ vẫn hoạt động bình thường.
- [ ] Researcher không còn bị đưa nhầm vào participant-only flow.
- [ ] Không regression create/update/invite Seminar hiện tại.

---

# API Checklist

| Action | Method | API | Role |
|---|---|---|---|
| Owner seminars | GET | `/api/Seminar` | Lecturer, Researcher |
| My invitations | GET | `/api/Seminar/my-invitations` | Authenticated |
| Seminar detail | GET | `/api/Seminar/{id}` | Owner / invited participant |
| Submit feedback | POST | `/api/Seminar/{id}/feedback` | Invited participant |
| Raw feedback list | GET | `/api/Seminar/{id}/feedback` | Owner |
| Stats | GET | `/api/Seminar/{id}/stats` | Owner |
| Feedback reminder | POST | `/api/Seminar/{id}/reminders/send` | Owner |
| Generate AI feedback | POST | `/api/Seminar/{id}/summarize-feedback` | Owner |
| Audio AI | POST | `/api/Seminar/{id}/summarize-audio` | Owner |
| Suggested invitees | GET | `/api/Seminar/suggested-invitees?subFieldId=...` | Authenticated |

---

## Business note chưa chốt

Hiện FE nên **chỉ render `AI Feedback Analysis` cho owner Lecturer/Researcher trước**.

Raw participant feedback chắc chắn owner-only.

Việc participant có được xem `Seminars.feedback` (AI aggregate cuối cùng) hay không chưa nên tự mở UI cho tới khi business chốt rõ.
