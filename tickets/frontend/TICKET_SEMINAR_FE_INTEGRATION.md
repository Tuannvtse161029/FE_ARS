# TICKET — FE Integration for Seminar / Feedback / AI Summary

**Baseline:** ARS110 backend + SQLQuery110 database schema  
**Audience:** Frontend Developer  
**Scope:** Seminar list/detail/create/update/invite, dynamic feedback form, participant feedback, feedback stats/reminders, AI feedback aggregation, AI audio summary  
**Canonical API prefix:** `/api/Seminar`

---

## 1. Mục tiêu ticket

FE cần nối Seminar theo đúng contract hiện tại của BE và hiểu rõ:

- API nào dùng cho Owner / Participant / Admin.
- API đọc dữ liệu từ bảng/cột nào.
- API ghi dữ liệu vào bảng/cột nào.
- Response nào là source of truth.
- `feedback`, `feedbackJson`, `aiSummary` khác nhau thế nào.
- Participant được xem dữ liệu nào và không được xem dữ liệu nào.
- Cách submit/edit dynamic feedback.
- Cách generate/regenerate AI Feedback Summary.
- Cách upload/regenerate AI Audio Summary.
- Những API/field legacy chỉ giữ compatibility, FE mới không nên dùng.

---

# 2. Terminology bắt buộc — KHÔNG được nhầm

Có **3 loại dữ liệu hoàn toàn khác nhau** trong Seminar:

| BE Response / DB column | DB Table | Ý nghĩa |
|---|---|---|
| `aiSummary` | `Seminars.aiSummary` | AI tóm tắt từ file audio/video Seminar |
| `feedback` | `Seminars.feedback` | JSON cấu hình feedback form do Owner tạo |
| `feedbackJson` trên `SeminarResponse` | `Seminars.FeedbackJson` | AI aggregate summary từ toàn bộ participant text feedback |
| `feedbackJson` trên `SeminarParticipantResponse` | `SeminarParticipants.FeedbackJson` | Raw answers của **một participant** gồm rating + text |
| `aiFeedbackGeneratedAt` | `Seminars.AiFeedbackGeneratedAt` | Thời điểm generate/regenerate AI Feedback Summary |
| `feedbackSubmittedAt` | `SeminarParticipants.FeedbackSubmittedAt` | Lần đầu participant submit feedback |
| `feedbackUpdatedAt` | `SeminarParticipants.FeedbackUpdatedAt` | Lần submit/edit feedback gần nhất |

## Tuyệt đối không làm

```text
Seminar.aiSummary
!= Seminar.feedback
!= Seminar.feedbackJson
!= SeminarParticipant.feedbackJson
```

---

# 3. Database source of truth

## 3.1 `dbo.Seminars`

Các cột FE cần hiểu:

```text
SeminarId
OrganizerId
StartTime
EndTime
Content
OnlineLink
MaxParticipants
IsReminderSent
Status
aiSummary
feedback
ReminderEnabled
ReminderSentAt
SubFieldId
AiFeedbackGeneratedAt
FeedbackJson
```

Ý nghĩa:

```text
Seminars.aiSummary
    = AI Seminar Audio/Video Summary

Seminars.feedback
    = Dynamic Feedback Form JSON

Seminars.FeedbackJson
    = AI Aggregate Feedback JSON

Seminars.AiFeedbackGeneratedAt
    = Generated time của AI Aggregate Feedback
```

---

## 3.2 `dbo.SeminarParticipants`

```text
SeminarParticipantId
SeminarId
UserId
InvitationStatus
InvitedEmail
InvitationSentAt
EventReminderSentAt
FeedbackReminderSentAt
FeedbackSubmittedAt
FeedbackJson
FeedbackUpdatedAt
```

Ý nghĩa quan trọng:

```text
SeminarParticipants.FeedbackJson
    = raw participant answers

FeedbackSubmittedAt
    = lần đầu submit

FeedbackUpdatedAt
    = lần submit/edit gần nhất
```

---

# 4. Roles / quyền

## Seminar Owner

Hiện Owner có thể là:

```text
Lecturer
Researcher
```

Owner được:

- Create Seminar.
- Update Seminar của mình.
- Delete Seminar của mình.
- Invite participant.
- Configure dynamic feedback form.
- Xem raw feedback của tất cả participant.
- Xem stats.
- Send feedback reminder.
- Generate/regenerate AI Feedback Summary.
- Upload/regenerate AI Audio Summary.

---

## Participant

Participant hợp lệ khi:

```text
SeminarParticipants.UserId == currentUserId
OR
SeminarParticipants.InvitedEmail == currentUser.Email
```

và:

```text
InvitationStatus != DECLINED
```

Participant được:

- Xem Seminar được mời.
- Xem feedback form.
- Submit/edit feedback của chính mình.
- Xem raw feedback của chính mình qua Seminar Detail.
- Xem AI aggregate feedback của Seminar qua Seminar Detail.

Participant **không được**:

- Xem raw feedback của participant khác.
- Generate AI summary.
- Config feedback form.
- Xem Owner raw feedback list.

---

## Admin

Admin hiện được phép:

- Xem raw feedback.
- Get feedback form.
- Update feedback form.

---

# 5. Canonical API list FE nên dùng

> Các alias cũ vẫn tồn tại để compatibility, nhưng FE mới nên dùng các route canonical dưới đây.

| Action | Method | Canonical API |
|---|---|---|
| Owner Seminar list | GET | `/api/Seminar` |
| Owner Seminar paged | GET | `/api/Seminar/paged` |
| Participant invitations | GET | `/api/Seminar/my-invitations` |
| Suggested invitees | GET | `/api/Seminar/suggested-invitees?subFieldId={id}` |
| Create Seminar | POST | `/api/Seminar` |
| Seminar detail | GET | `/api/Seminar/{id}` |
| Update Seminar | PUT | `/api/Seminar/{id}` |
| Delete Seminar | DELETE | `/api/Seminar/{id}` |
| Invite | POST | `/api/Seminar/{id}/invite` |
| Get feedback form | GET | `/api/Seminar/{id}/feedback-form` |
| Save feedback form | PUT | `/api/Seminar/{id}/feedback-form` |
| Submit/Edit participant feedback | POST | `/api/Seminar/{id}/feedback` |
| Owner raw feedback list | GET | `/api/Seminar/{id}/feedback` |
| Stats | GET | `/api/Seminar/{id}/stats` |
| Feedback reminders | POST | `/api/Seminar/{id}/reminders/send` |
| Generate AI Feedback Summary | POST | `/api/Seminar/{id}/summarize-feedback` |
| AI Audio Summary | POST | `/api/Seminar/{id}/summarize-audio` |

---

# 6. SeminarResponse — object chính của Seminar Detail

FE nên khai báo type gần như sau:

```ts
export interface SeminarResponse {
  seminarId: number;
  organizerId?: number | null;

  startTime: string;
  endTime: string;
  content: string;

  onlineLink?: string | null;
  maxParticipants?: number | null;

  isReminderSent?: boolean | null;
  reminderEnabled: boolean;
  reminderSentAt?: string | null;

  status?: string | null;

  // AI audio/video summary
  aiSummary?: string | null;

  // JSON string của feedback form
  feedback?: string | null;

  // JSON string của AI aggregate participant feedback
  feedbackJson?: string | null;

  aiFeedbackGeneratedAt?: string | null;

  subFieldId?: number | null;
  subFieldName?: string | null;

  participants: SeminarParticipantResponse[];
}
```

---

# 7. GET `/api/Seminar`

## Dùng cho

Owner `Lecturer` / `Researcher`.

## BE query

```text
Seminars
WHERE OrganizerId = JWT currentUserId
```

có participant data.

## Response

```ts
SeminarResponse[]
```

## Lưu ý cực quan trọng

Controller hiện **cố tình set**:

```text
aiSummary = null
```

trong list response.

Vì vậy:

```text
GET /api/Seminar
```

không phải API để lấy Audio AI Summary đầy đủ.

Muốn lấy detail đầy đủ:

```http
GET /api/Seminar/{id}
```

---

# 8. GET `/api/Seminar/paged`

## Query

Ví dụ:

```http
GET /api/Seminar/paged?pageNumber=1&pageSize=10
```

## Response

```ts
interface PagedResult<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}
```

## Scope

Chỉ Seminar:

```text
OrganizerId == current user
```

## Lưu ý

`aiSummary` cũng bị set `null` ở list paged.

---

# 9. POST `/api/Seminar` — Create Seminar

## Role

```text
Lecturer
Researcher
```

## Request

```ts
interface SeminarCreateRequest {
  startTime: string;
  endTime: string;
  content: string;

  maxParticipants?: number | null;

  // Legacy naming:
  // Khi CREATE, field này thực chất mang nghĩa enable reminder scheduling.
  isReminderSent?: boolean | null;

  status?: string | null;
  guestEmails?: string[] | null;
  subFieldId?: number | null;
}
```

Ví dụ:

```json
{
  "startTime": "2026-09-20T02:00:00Z",
  "endTime": "2026-09-20T04:00:00Z",
  "content": "Applied Artificial Intelligence in Academic Research",
  "maxParticipants": 50,
  "isReminderSent": true,
  "status": "Upcoming",
  "subFieldId": 5,
  "guestEmails": [
    "participant1@example.com",
    "participant2@example.com"
  ]
}
```

## BE flow

```text
JWT
 ↓
organizerId
 ↓
validate start/end/content/maxParticipants
 ↓
normalize guest emails
 ↓
Google Meet
 ↓
INSERT dbo.Seminars
 ↓
INSERT dbo.SeminarParticipants
 ↓
create notification nếu email match User
 ↓
send invitation email
 ↓
set InvitationSentAt nếu gửi mail thành công
```

## DB write

### `Seminars`

```text
OrganizerId
StartTime
EndTime
Content
OnlineLink
MaxParticipants
ReminderEnabled
IsReminderSent
ReminderSentAt
SubFieldId
Status
```

### `SeminarParticipants`

Mỗi guest email:

```text
SeminarId
UserId             // có nếu email match User
InvitedEmail
InvitationStatus = INVITED
InvitationSentAt   // sau khi email gửi thành công
```

## Response

```ts
SeminarResponse
```

---

# 10. PUT `/api/Seminar/{id}` — Update Seminar

## Role

Owner Lecturer/Researcher.

## Request

```ts
interface SeminarUpdateRequest {
  startTime?: string | null;
  endTime?: string | null;
  content?: string | null;
  maxParticipants?: number | null;

  // LEGACY:
  // true hiện trigger SendFeedbackRemindersAsync
  isReminderSent?: boolean | null;

  // Field đúng để enable/disable event reminder scheduler
  reminderEnabled?: boolean | null;

  status?: string | null;
  subFieldId?: number | null;
}
```

## Cảnh báo FE

### Không dùng `isReminderSent` để control event reminder checkbox mới

Hiện BE có backward compatibility:

```text
PUT { isReminderSent: true }
```

sẽ trigger:

```text
SendFeedbackRemindersAsync(...)
```

tức là gửi **feedback reminder**, không đơn thuần set flag.

FE mới nên dùng:

```json
{
  "reminderEnabled": true
}
```

cho event reminder setting.

---

# 11. GET `/api/Seminar/{id}` — Seminar Detail

Đây là **API trung tâm** FE nên gọi khi mở Seminar Detail.

## Owner

Owner nhận:

```text
Seminar data
+
all Participants
+
raw FeedbackJson của tất cả participant
+
AI aggregate FeedbackJson
+
AI audio AiSummary
```

---

## Participant

BE kiểm tra participant bằng:

```text
UserId == currentUserId
OR InvitedEmail == currentUser.Email
```

và:

```text
InvitationStatus != DECLINED
```

Sau đó BE mask raw feedback participant khác.

### Participant A nhận

```text
Participant A FeedbackJson      = visible
Participant B FeedbackJson      = null
Participant C FeedbackJson      = null

Seminar.feedback                = visible
Seminar.feedbackJson            = visible
Seminar.aiSummary               = visible
```

## Outsider / DECLINED

```http
404 Not Found
```

FE không nên phân biệt:

```text
Seminar không tồn tại
vs
không có quyền xem
```

---

# 12. Participant raw response type

```ts
export interface SeminarParticipantResponse {
  seminarParticipantId: number;
  seminarId?: number | null;

  userId?: number | null;
  userFullName?: string | null;
  userEmail?: string | null;
  invitedEmail?: string | null;

  invitationStatus?: string | null;

  // SOURCE OF TRUTH cho dynamic participant answers
  feedbackJson?: string | null;

  // Legacy parsed structured object; dynamic array có thể không parse vào field này
  feedback?: SeminarFeedbackContent | null;

  // Legacy
  participantEvaluation?: string | null;

  feedbackSubmittedAt?: string | null;
  feedbackUpdatedAt?: string | null;

  invitationSentAt?: string | null;
  eventReminderSentAt?: string | null;
  feedbackReminderSentAt?: string | null;
}
```

---

# 13. Dynamic Feedback Form

## 13.1 GET `/api/Seminar/{id}/feedback-form`

## Access

```text
Admin
Owner
Valid Participant
```

`DECLINED` và outsider không được.

## DB read

```text
Seminars.feedback
+
SeminarParticipants membership
+
User.Email nếu cần match invited email
```

## Response

```ts
interface SeminarFeedbackFormResponse {
  seminarId: number;

  // raw JSON string lưu trong DB
  feedback?: string | null;

  // parsed list để FE bind trực tiếp
  questions: SeminarFeedbackQuestion[];

  message: string;
}
```

---

## 13.2 Question DTO

```ts
export interface SeminarFeedbackQuestion {
  id?: string | null;
  orderIndex: number;

  type: 'rating' | 'text';

  questionText?: string | null;
  isRequired: boolean;

  maxStar?: number | null;
}
```

### Với `rating`

Ví dụ:

```json
{
  "id": "q-rating",
  "orderIndex": 0,
  "type": "rating",
  "questionText": "Bạn đánh giá mức độ hữu ích của seminar?",
  "isRequired": true,
  "maxStar": 5
}
```

### Với `text`

```json
{
  "id": "q-improve",
  "orderIndex": 1,
  "type": "text",
  "questionText": "Điều gì cần cải thiện?",
  "isRequired": false,
  "maxStar": null
}
```

---

# 14. PUT `/api/Seminar/{id}/feedback-form`

Canonical API owner dùng để Save / Activate form:

```http
PUT /api/Seminar/{id}/feedback-form
```

POST alias hiện còn tồn tại:

```http
POST /api/Seminar/{id}/feedback-form
```

FE mới **ưu tiên PUT**.

## Recommended request

FE gửi array trực tiếp:

```json
[
  {
    "id": "q-rating",
    "orderIndex": 0,
    "type": "rating",
    "questionText": "Bạn đánh giá seminar?",
    "isRequired": true,
    "maxStar": 5
  },
  {
    "id": "q-improve",
    "orderIndex": 1,
    "type": "text",
    "questionText": "Điều gì cần cải thiện?",
    "isRequired": false,
    "maxStar": null
  }
]
```

BE cũng support legacy wrappers:

```json
{
  "questions": [...]
}
```

hoặc:

```json
{
  "feedback": [...]
}
```

Nhưng FE mới nên gửi **array trực tiếp** để contract đơn giản.

## DB write

Chỉ:

```text
Seminars.feedback
```

Không ghi:

```text
Seminars.FeedbackJson
Seminars.aiSummary
```

---

# 15. Feedback Form FE validation

FE nên validate trước khi gọi API:

```text
type phải là rating hoặc text
questionText không rỗng
question id không duplicate
maxStar > 0 nếu có
```

Nếu FE không tự tạo `id`, BE hiện có compatibility tự sinh:

```text
q_1
q_2
q_3
```

Tuy nhiên FE nên giữ ID ổn định khi edit form, vì participant answers map bằng:

```text
questionId → question.id
```

## Khuyến nghị

Khi create question mới:

```ts
id: crypto.randomUUID()
```

hoặc một stable client id khác.

Không nên regenerate ID mỗi lần edit form.

---

# 16. POST `/api/Seminar/{id}/feedback` — Participant Submit/Edit Feedback

Đây là **canonical endpoint**.

```http
POST /api/Seminar/{seminarId}/feedback
```

## Alias compatibility

```http
POST /api/Seminar/{seminarId}/feedback-answers

POST /api/SeminarParticipant/feedback/{seminarId}
POST /api/SeminarParticipant/{seminarId}/feedback
POST /api/SeminarParticipant/{seminarId}/feedback-answers
```

FE mới không cần dùng các alias trên.

---

## 16.1 Request được khuyến nghị

```json
{
  "answers": [
    {
      "questionId": "q-rating",
      "type": "rating",
      "rating": 5
    },
    {
      "questionId": "q-improve",
      "type": "text",
      "text": "Phần Q&A hơi ngắn."
    }
  ]
}
```

FE **không cần tin vào client `orderIndex`**.

BE normalize order dựa trên feedback form thật trong DB.

---

## 16.2 Answer type

```ts
export interface SeminarFeedbackAnswer {
  questionId?: string | null;
  orderIndex?: number;

  type?: 'rating' | 'text' | null;

  rating?: number | null;
  text?: string | null;
}
```

### Rating answer

```json
{
  "questionId": "q-rating",
  "type": "rating",
  "rating": 5
}
```

### Text answer

```json
{
  "questionId": "q-improve",
  "type": "text",
  "text": "Phần Q&A nên dài hơn."
}
```

---

# 17. BE validation khi participant submit

BE lấy:

```text
Seminars.feedback
```

làm form source of truth.

Sau đó check:

```text
participant có thật trong Seminar?
not DECLINED?
questionId có tồn tại?
duplicate questionId?
required question đã trả lời?
answer.type có match question.type?
rating nằm trong 1..maxStar?
rating question có text sai không?
text question có rating sai không?
```

Participant không thể tự gửi câu hỏi ngoài form.

---

# 18. DB write sau Submit Feedback

Raw data được lưu:

```text
SeminarParticipants.FeedbackJson
```

Canonical JSON ví dụ:

```json
[
  {
    "questionId": "q-rating",
    "orderIndex": 0,
    "type": "rating",
    "rating": 5,
    "text": null
  },
  {
    "questionId": "q-improve",
    "orderIndex": 1,
    "type": "text",
    "rating": null,
    "text": "Phần Q&A hơi ngắn."
  }
]
```

BE đồng thời update:

```text
FeedbackSubmittedAt ??= now
FeedbackUpdatedAt = now
InvitationStatus = SUBMITTED
```

## Edit feedback

Không cần API mới.

Participant submit lại cùng endpoint:

```http
POST /api/Seminar/{id}/feedback
```

BE:

```text
FeedbackJson          overwrite
FeedbackSubmittedAt   giữ lần đầu
FeedbackUpdatedAt     cập nhật lần mới
```

---

# 19. FE xác định participant đã feedback hay chưa

## KHÔNG nên dùng

```ts
invitationStatus === 'SUBMITTED'
```

làm source of truth duy nhất.

## Nên dùng

Khi có Seminar Detail:

```ts
const hasSubmittedFeedback =
  participant.feedbackJson != null ||
  participant.feedbackSubmittedAt != null;
```

Lý do:

```text
InvitationStatus
= invitation lifecycle / compatibility

FeedbackJson + FeedbackSubmittedAt
= feedback lifecycle
```

---

# 20. Prefill khi Edit Feedback

## Không dùng `GET /my-invitations` để prefill dynamic answers

`SeminarInvitationResponse` hiện chỉ expose legacy:

```text
feedback
participantEvaluation
feedbackSubmittedAt
feedbackUpdatedAt
```

Nó **không expose raw dynamic `FeedbackJson`**.

Vì vậy flow Edit nên:

```text
open Seminar Detail
 ↓
GET /api/Seminar/{id}
 ↓
find current participant
 ↓
parse participant.feedbackJson
 ↓
prefill form
```

---

# 21. GET `/api/Seminar/{id}/feedback` — Owner Raw Feedback

## Roles

```text
Lecturer
Researcher
Admin
```

Owner còn được BE check ownership.

## DB read

```text
SeminarParticipants
+
User
```

FE nhận:

```ts
SeminarParticipantResponse[]
```

## Source of truth

Dynamic feedback:

```text
row.feedbackJson
```

Không nên dùng:

```text
row.feedback
row.participantEvaluation
```

làm model chính.

Hai field đó chỉ compatibility.

---

# 22. Render Owner Raw Feedback

FE parse:

```ts
const answers = parseParticipantFeedback(row.feedbackJson);
```

Ví dụ UI:

```text
Participant Name
participant@email.com

★ Rating
5 / 5

Điều gì cần cải thiện?
Phần Q&A hơi ngắn.

Submitted: ...
Updated: ...
```

Để lấy question label:

```text
answer.questionId
 ↓
match với feedbackForm.questions[].id
 ↓
question.questionText
```

---

# 23. GET `/api/Seminar/{id}/stats`

## Role

Owner Lecturer/Researcher.

## BE tính

```text
totalInvited
= total participant records

declined
= InvitationStatus == DECLINED

submitted
= not DECLINED
  AND FeedbackJson not null/blank

pending
= totalInvited - submitted - declined

completionPercentage
= submitted / totalInvited * 100
```

## Response

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

## Không có

```text
averageRating
averageScore
```

FE không tự tạo các field này từ BE stats.

---

# 24. POST `/api/Seminar/{id}/reminders/send`

Owner gửi feedback reminder.

## Eligible

Participant phải:

```text
InvitationStatus != DECLINED
AND FeedbackJson null/empty
AND FeedbackReminderSentAt == null
```

Nếu gửi mail thành công:

```text
SeminarParticipants.FeedbackReminderSentAt = now
```

## Response

```ts
export interface SeminarReminderResponse {
  seminarId: number;
  eligible: number;
  sent: number;
  skipped: number;
  failedEmails: string[];
}
```

---

# 25. Suggested Invitees

```http
GET /api/Seminar/suggested-invitees?subFieldId={subFieldId}
```

## FE flow

```text
Owner chọn SubField
 ↓
call suggested-invitees
 ↓
show suggested users
 ↓
owner select emails
 ↓
POST /api/Seminar/{id}/invite
```

## Response

```ts
export interface SuggestedInvitee {
  userId: number;
  fullName: string;
  email: string;

  avatarUrl?: string | null;
  role?: string | null;

  subFieldId?: number | null;
  subFieldName?: string | null;

  orcidId?: string | null;
  hindex?: number | null;
  publicationCount?: number | null;
}
```

---

# 26. POST `/api/Seminar/{id}/invite`

## Request

```json
{
  "emails": [
    "a@example.com",
    "b@example.com"
  ]
}
```

## Response

```ts
export interface SeminarInviteResponse {
  seminarId: number;
  requested: number;
  added: number;
  sent: number;
  skipped: number;
  failedEmails: string[];
}
```

## Meaning

```text
requested = số email request ban đầu
added     = số participant record mới tạo
sent      = số email invitation gửi thành công
skipped   = duplicate/already sent/no email...
failed    = danh sách email send lỗi
```

---

# 27. GET `/api/Seminar/my-invitations`

Participant dùng để list Seminar mình được mời.

## Response

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

  // Legacy object only
  feedback?: SeminarFeedbackContent | null;
  participantEvaluation?: string | null;

  feedbackSubmittedAt?: string | null;
  feedbackUpdatedAt?: string | null;
}
```

## Lưu ý

Dynamic `FeedbackJson` không có trong DTO này.

Màn list có thể dùng:

```text
feedbackSubmittedAt != null
```

để hiển thị "Đã đánh giá".

Nhưng muốn view/edit raw dynamic answers:

```http
GET /api/Seminar/{id}
```

---

# 28. AI Feedback Summary

## API

```http
POST /api/Seminar/{id}/summarize-feedback
```

## Role

```text
Lecturer
Researcher
```

và BE check actual OrganizerId.

Không có request body.

---

# 29. AI Feedback data flow

BE lấy:

```text
Seminars.Content
Seminars.feedback

+

SeminarParticipants.FeedbackJson
WHERE not DECLINED
AND FeedbackJson not null
```

Raw:

```json
[
  {
    "questionId": "q-rating",
    "type": "rating",
    "rating": 5
  },
  {
    "questionId": "q-improve",
    "type": "text",
    "text": "Q&A hơi ngắn."
  }
]
```

BE xử lý:

```text
rating
 → REMOVE

text answer
 → lấy questionId

questionId
 → map với Seminars.feedback

 → questionText + text answer
```

Gemini nhận tương đương:

```json
[
  {
    "question": "Điều gì cần cải thiện?",
    "answer": "Q&A hơi ngắn."
  }
]
```

## Gemini KHÔNG nhận

```text
rating
maxStar
UserId
FullName
Email
InvitedEmail
SeminarParticipantId
```

---

# 30. AI Feedback response

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

Ví dụ:

```json
{
  "seminarId": 12,
  "feedbackCount": 6,
  "feedback": {
    "overallAssessment": "Phản hồi nhìn chung tích cực...",
    "commonStrengths": [
      "Nội dung thực tế"
    ],
    "areasForImprovement": [
      "Cần tăng thời gian Q&A"
    ],
    "commonSuggestions": [
      "Chia sẻ tài liệu sau seminar"
    ],
    "conflictingFeedback": [],
    "recommendedActions": [
      "Dành thêm thời gian cho phần hỏi đáp"
    ]
  },
  "generatedAt": "2026-09-09T05:00:00Z"
}
```

---

# 31. AI Feedback persistence

Sau generate:

```text
Seminars.FeedbackJson
    = serialized AI result

Seminars.AiFeedbackGeneratedAt
    = now
```

## Regenerate

Không có `replaceExisting`.

FE gọi lại:

```http
POST /api/Seminar/{id}/summarize-feedback
```

BE tự overwrite kết quả cũ.

---

# 32. Hiển thị AI Feedback đã lưu

Sau page refresh:

```http
GET /api/Seminar/{id}
```

FE lấy:

```text
seminar.feedbackJson
seminar.aiFeedbackGeneratedAt
```

`feedbackJson` ở đây là **JSON string**.

Phải parse.

```ts
export interface SeminarFeedbackAiContent {
  overallAssessment: string;
  commonStrengths: string[];
  areasForImprovement: string[];
  commonSuggestions: string[];
  conflictingFeedback: string[];
  recommendedActions: string[];
}

export function parseAiFeedback(
  value?: string | null
): SeminarFeedbackAiContent | null {
  if (!value) return null;

  try {
    return JSON.parse(value) as SeminarFeedbackAiContent;
  } catch {
    return null;
  }
}
```

Không render raw JSON string trực tiếp.

---

# 33. `feedbackCount` nuance

Hiện BE trả:

```text
feedbackCount
= số participant có FeedbackJson
```

Không phải:

```text
số text answers Gemini thực sự sử dụng
```

Participant chỉ submit rating vẫn có thể được tính vào `feedbackCount`, mặc dù rating bị remove khỏi Gemini input.

FE chỉ dùng field này như:

```text
number of feedback submissions considered
```

không gọi nó là:

```text
number of text comments
```

---

# 34. AI Audio Summary

## API

```http
POST /api/Seminar/{id}/summarize-audio
```

## Content-Type

```text
multipart/form-data
```

## Request

```ts
FormData:
  AudioFile: File
  ReplaceExisting: boolean
```

Ví dụ:

```ts
const formData = new FormData();

formData.append('AudioFile', file);
formData.append('ReplaceExisting', String(replaceExisting));

await api.post(
  `/api/Seminar/${seminarId}/summarize-audio`,
  formData
);
```

---

# 35. Audio Summary persistence

Sau Gemini:

```text
Seminars.aiSummary
```

được update.

Response:

```ts
export interface SeminarAudioSummaryResponse {
  seminarId: number;
  aiSummary: string;
  updatedAt?: string | null;
}
```

---

# 36. Audio `409 Conflict`

Nếu:

```text
Seminars.aiSummary đã tồn tại
AND ReplaceExisting == false
```

response:

```json
{
  "code": "SUMMARY_ALREADY_EXISTS",
  "message": "Seminar đã có AI Summary. Hãy xác nhận nếu muốn thay thế kết quả hiện tại."
}
```

FE flow:

```text
409 SUMMARY_ALREADY_EXISTS
 ↓
show confirm modal
 ↓
user confirms
 ↓
call lại với ReplaceExisting = true
```

---

# 37. Không tạo API save AI Audio riêng ở FE

BE `summarize-audio` đã:

```text
Gemini
 ↓
save Seminars.aiSummary
 ↓
return response
```

FE **không cần**:

```http
PUT /api/Seminar/{id}/ai-summary
```

Nếu FE hiện có call đó thì bỏ.

---

# 38. Event Reminder và Feedback Reminder là hai feature khác nhau

## Event reminder

Data:

```text
Seminars.ReminderEnabled
Seminars.IsReminderSent
Seminars.ReminderSentAt
SeminarParticipants.EventReminderSentAt
```

Dùng để nhắc:

```text
Seminar sắp diễn ra
```

---

## Feedback reminder

Data:

```text
SeminarParticipants.FeedbackReminderSentAt
```

Dùng để nhắc:

```text
Participant chưa submit feedback
```

API manual:

```http
POST /api/Seminar/{id}/reminders/send
```

FE không trộn hai loại reminder.

---

# 39. InvitationStatus

BE normalize trạng thái về:

```text
PENDING
INVITED
SUBMITTED
DECLINED
```

Một số synonym legacy BE chấp nhận:

```text
accepted / confirmed  → INVITED
complete / completed  → SUBMITTED
rejected              → DECLINED
```

FE mới nên dùng đúng canonical values:

```ts
type SeminarInvitationStatus =
  | 'PENDING'
  | 'INVITED'
  | 'SUBMITTED'
  | 'DECLINED';
```

---

# 40. FE không dùng `SeminarParticipant PUT` để submit feedback

Có endpoint legacy:

```http
PUT /api/SeminarParticipant/{seminarParticipantId}
```

Nhưng service hiện đã block feedback payload qua endpoint này.

Nếu Participant cố gửi feedback qua PUT:

```text
400
Participant feedback must be submitted through POST /api/Seminar/{seminarId}/feedback.
```

Canonical submit/edit feedback luôn là:

```http
POST /api/Seminar/{seminarId}/feedback
```

---

# 41. Legacy feedback fields — chỉ compatibility

Các field sau vẫn tồn tại nhưng FE mới **không lấy làm source of truth**:

```text
participantEvaluation

SeminarParticipantResponse.feedback
SeminarInvitationResponse.feedback
```

Dynamic feedback chính:

```text
SeminarParticipantResponse.feedbackJson
```

---

# 42. Parse participant `feedbackJson`

```ts
export interface SeminarFeedbackAnswer {
  questionId: string;
  orderIndex: number;
  type: 'rating' | 'text';
  rating?: number | null;
  text?: string | null;
}

export function parseParticipantAnswers(
  value?: string | null
): SeminarFeedbackAnswer[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);

    return Array.isArray(parsed)
      ? (parsed as SeminarFeedbackAnswer[])
      : [];
  } catch {
    return [];
  }
}
```

Legacy object có thể không phải array.

Nếu cần compatibility:

```ts
export function isDynamicFeedback(
  value: unknown
): value is SeminarFeedbackAnswer[] {
  return Array.isArray(value);
}
```

---

# 43. Parse Seminar feedback form

Dù API `GET /feedback-form` đã trả `questions`, Seminar Detail còn có:

```text
seminar.feedback
```

là JSON string.

Nếu FE cần parse từ detail:

```ts
export function parseFeedbackForm(
  value?: string | null
): SeminarFeedbackQuestion[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);

    return Array.isArray(parsed)
      ? (parsed as SeminarFeedbackQuestion[])
      : [];
  } catch {
    return [];
  }
}
```

Ưu tiên khi mở form:

```http
GET /api/Seminar/{id}/feedback-form
```

vì response có `questions` parse sẵn.

---

# 44. Owner page recommended API flow

## Open owner Seminar list

```text
GET /api/Seminar
```

hoặc paged:

```text
GET /api/Seminar/paged
```

---

## Open Seminar Detail

Gọi song song khi cần:

```text
GET /api/Seminar/{id}
GET /api/Seminar/{id}/stats
GET /api/Seminar/{id}/feedback
GET /api/Seminar/{id}/feedback-form
```

Không bắt buộc gọi tất cả nếu tab chưa mở.

Recommended lazy loading:

```text
Detail tab
 → GET Seminar/{id}

Feedback tab
 → GET feedback
 → GET feedback-form
 → GET stats

AI Feedback tab
 → parse seminar.feedbackJson

Audio Summary tab
 → seminar.aiSummary
```

---

# 45. Participant page recommended flow

## Invitation list

```http
GET /api/Seminar/my-invitations
```

## Open one Seminar

```http
GET /api/Seminar/{id}
```

## Open feedback modal/page

```http
GET /api/Seminar/{id}/feedback-form
```

Sau đó:

```text
Seminar Detail
 ↓
find own participant
 ↓
parse own participant.feedbackJson
 ↓
prefill form nếu đã submit
```

## Submit/Edit

```http
POST /api/Seminar/{id}/feedback
```

Sau success:

```text
update local answers
or
refetch GET /api/Seminar/{id}
```

---

# 46. Owner AI Feedback UX

Recommended:

```text
Participant Feedback
--------------------

6 / 10 submitted

[Send Reminder]
[Generate AI Feedback Summary]
```

Nếu đã có:

```text
seminar.feedbackJson != null
```

button đổi:

```text
Regenerate AI Feedback Summary
```

Recommended confirm:

```text
A new AI summary will replace the current feedback summary. Continue?
```

---

# 47. Loading states nên tách riêng

Không dùng một `isLoading` chung.

Recommended:

```ts
seminarLoading
feedbackFormLoading
feedbackSubmitting
rawFeedbackLoading
statsLoading
reminderSending
feedbackAiGenerating
audioAiGenerating
inviteSending
```

---

# 48. Error handling

Ưu tiên message BE:

```ts
const message =
  error.response?.data?.message ??
  'Something went wrong.';
```

## Common statuses

### `400`

Validation/business input:

```text
invalid feedback
required question missing
invalid rating
invalid time
invalid email
no feedback available for AI
```

### `401`

JWT missing/invalid.

### `403`

Logged in nhưng không có quyền.

Ví dụ:

```text
owner cố submit feedback thay participant
non-owner config form
```

### `404`

```text
Seminar not found
or viewer access denied
```

### `409`

Ví dụ:

```text
Audio summary already exists
Invite would exceed MaxParticipants
duplicate participant
```

### `502`

External service lỗi:

```text
Gemini
Google Meet
```

### `504`

Audio AI timeout.

---

# 49. FE source-of-truth checklist

## Seminar list

```text
GET /api/Seminar
```

## Seminar detail

```text
GET /api/Seminar/{id}
```

## Dynamic form

```text
GET /api/Seminar/{id}/feedback-form
PUT /api/Seminar/{id}/feedback-form
```

## Participant answer

```text
SeminarParticipant.feedbackJson
```

## Participant submit state

```text
feedbackJson
or
feedbackSubmittedAt
```

## Owner all raw feedback

```text
GET /api/Seminar/{id}/feedback
```

## AI Feedback saved result

```text
Seminar.feedbackJson
```

## Audio AI saved result

```text
Seminar.aiSummary
```

---

# 50. FE tuyệt đối không nối nhầm

## Sai

```ts
const aiFeedback = seminar.aiSummary;
```

## Đúng

```ts
const audioSummary = seminar.aiSummary;

const aiFeedback = parseAiFeedback(
  seminar.feedbackJson
);
```

---

## Sai

```ts
const participantAnswers = row.feedback;
```

## Đúng

```ts
const participantAnswers =
  parseParticipantAnswers(
    row.feedbackJson
  );
```

---

## Sai

```ts
const hasSubmitted =
  invitationStatus === 'SUBMITTED';
```

## Đúng

```ts
const hasSubmitted =
  participant.feedbackJson != null ||
  participant.feedbackSubmittedAt != null;
```

---

# 51. Recommended FE TypeScript models

```ts
export type FeedbackQuestionType =
  | 'rating'
  | 'text';

export interface SeminarFeedbackQuestion {
  id?: string | null;
  orderIndex: number;
  type: FeedbackQuestionType;
  questionText?: string | null;
  isRequired: boolean;
  maxStar?: number | null;
}

export interface SeminarFeedbackAnswer {
  questionId?: string | null;
  orderIndex?: number;
  type?: FeedbackQuestionType | null;
  rating?: number | null;
  text?: string | null;
}

export interface SeminarFeedbackAiContent {
  overallAssessment: string;
  commonStrengths: string[];
  areasForImprovement: string[];
  commonSuggestions: string[];
  conflictingFeedback: string[];
  recommendedActions: string[];
}

export interface SeminarParticipantResponse {
  seminarParticipantId: number;
  seminarId?: number | null;
  userId?: number | null;

  userFullName?: string | null;
  userEmail?: string | null;
  invitedEmail?: string | null;

  invitationStatus?: string | null;

  feedbackJson?: string | null;

  feedbackSubmittedAt?: string | null;
  feedbackUpdatedAt?: string | null;

  invitationSentAt?: string | null;
  eventReminderSentAt?: string | null;
  feedbackReminderSentAt?: string | null;

  // Legacy only
  feedback?: unknown;
  participantEvaluation?: string | null;
}

export interface SeminarResponse {
  seminarId: number;
  organizerId?: number | null;

  startTime: string;
  endTime: string;
  content: string;

  onlineLink?: string | null;
  maxParticipants?: number | null;

  isReminderSent?: boolean | null;
  reminderEnabled: boolean;
  reminderSentAt?: string | null;

  status?: string | null;

  aiSummary?: string | null;

  // form config JSON string
  feedback?: string | null;

  // AI aggregate JSON string
  feedbackJson?: string | null;

  aiFeedbackGeneratedAt?: string | null;

  subFieldId?: number | null;
  subFieldName?: string | null;

  participants: SeminarParticipantResponse[];
}
```

---

# 52. Recommended FE API service

```ts
export const seminarApi = {
  getAll: () =>
    api.get('/api/Seminar'),

  getPaged: (
    pageNumber: number,
    pageSize: number
  ) =>
    api.get('/api/Seminar/paged', {
      params: {
        pageNumber,
        pageSize
      }
    }),

  getMyInvitations: () =>
    api.get(
      '/api/Seminar/my-invitations'
    ),

  getById: (
    seminarId: number
  ) =>
    api.get(
      `/api/Seminar/${seminarId}`
    ),

  create: (
    payload: SeminarCreateRequest
  ) =>
    api.post(
      '/api/Seminar',
      payload
    ),

  update: (
    seminarId: number,
    payload: SeminarUpdateRequest
  ) =>
    api.put(
      `/api/Seminar/${seminarId}`,
      payload
    ),

  remove: (
    seminarId: number
  ) =>
    api.delete(
      `/api/Seminar/${seminarId}`
    ),

  getSuggestedInvitees: (
    subFieldId: number
  ) =>
    api.get(
      '/api/Seminar/suggested-invitees',
      {
        params: {
          subFieldId
        }
      }
    ),

  invite: (
    seminarId: number,
    emails: string[]
  ) =>
    api.post(
      `/api/Seminar/${seminarId}/invite`,
      {
        emails
      }
    ),

  getFeedbackForm: (
    seminarId: number
  ) =>
    api.get(
      `/api/Seminar/${seminarId}/feedback-form`
    ),

  saveFeedbackForm: (
    seminarId: number,
    questions: SeminarFeedbackQuestion[]
  ) =>
    api.put(
      `/api/Seminar/${seminarId}/feedback-form`,
      questions
    ),

  submitFeedback: (
    seminarId: number,
    answers: SeminarFeedbackAnswer[]
  ) =>
    api.post(
      `/api/Seminar/${seminarId}/feedback`,
      {
        answers
      }
    ),

  getRawFeedback: (
    seminarId: number
  ) =>
    api.get(
      `/api/Seminar/${seminarId}/feedback`
    ),

  getStats: (
    seminarId: number
  ) =>
    api.get(
      `/api/Seminar/${seminarId}/stats`
    ),

  sendFeedbackReminders: (
    seminarId: number
  ) =>
    api.post(
      `/api/Seminar/${seminarId}/reminders/send`
    ),

  summarizeFeedback: (
    seminarId: number
  ) =>
    api.post(
      `/api/Seminar/${seminarId}/summarize-feedback`
    ),

  summarizeAudio: (
    seminarId: number,
    data: FormData
  ) =>
    api.post(
      `/api/Seminar/${seminarId}/summarize-audio`,
      data
    )
};
```

---

# 53. Owner screen mapping

Recommended structure:

```text
Seminar Detail
│
├── Seminar Information
│   ├── Content
│   ├── Time
│   ├── Google Meet
│   ├── SubField
│   └── Reminder settings
│
├── Participants
│   ├── Invite
│   └── Suggested Invitees
│
├── AI Seminar Summary
│   └── seminar.aiSummary
│
├── Feedback Form
│   └── Seminars.feedback
│
├── Participant Feedback
│   ├── raw participant.feedbackJson
│   ├── stats
│   └── reminder
│
└── AI Feedback Analysis
    └── Seminars.FeedbackJson
```

Không trộn:

```text
AI Seminar Summary
```

với:

```text
AI Feedback Analysis
```

---

# 54. Participant screen mapping

```text
My Seminar Invitation
│
├── Seminar Information
│
├── AI Seminar Summary
│
├── AI Feedback Analysis
│
└── My Feedback
    ├── GET feedback-form
    ├── own participant.feedbackJson
    └── POST feedback
```

Không có:

```text
All Participant Feedback
```

ở participant UI.

---

# 55. Known current BE caveats FE cần biết

Đây là các điểm FE nên code theo **contract đúng**, không dựa vào behavior dễ dãi hiện tại.

## 55.1 Feedback Form validation đang được harden

FE bắt buộc tự enforce:

```text
type = rating | text
questionText not blank
stable unique id
maxStar > 0
```

Không gửi invalid `type`.

---

## 55.2 `GET /my-invitations` chưa trả dynamic FeedbackJson

Muốn prefill edit:

```http
GET /api/Seminar/{id}
```

---

## 55.3 Không set `SUBMITTED` thủ công

FE không gọi:

```http
PUT /api/SeminarParticipant/{id}
```

với:

```json
{
  "invitationStatus": "SUBMITTED"
}
```

`SUBMITTED` phải được BE tự set sau:

```http
POST /api/Seminar/{id}/feedback
```

---

## 55.4 `SubFieldId`

FE phải gửi `SubFieldId` tồn tại thật trong DB.

Không gửi arbitrary ID.

---

## 55.5 `endTime` — placeholder và BE gap

### Vấn đề

`POST /api/Seminar` (BE Swagger §9) yêu cầu `endTime` là **required**. FE gửi `startTime + 1h` như một placeholder để BE chấp nhận request. Hậu quả: sau đúng 1 giờ kể từ `startTime`, `deriveEffectiveStatus()` tự động flip seminar sang `COMPLETED` — ngay cả khi buổi hội thảo vẫn đang diễn ra. Lecturer không có quyền kiểm soát khi nào seminar kết thúc.

### Giải pháp tạm thời (FE)

FE gửi `startTime + SEMINAR_PLACEHOLDER_DURATION_MS` (1 giờ) trên `POST`. Giá trị này được đánh dấu rõ ràng trên form bằng helper text dưới input Date & Time. Xem:

- `src/utils/constants.ts` → `SEMINAR_PLACEHOLDER_DURATION_MS`
- `src/pages/Lecturer/SeminarWorkspace.tsx` → helper copy dưới input
- `src/features/seminars/SeminarWorkspace.tsx` → helper copy dưới input

### Giải pháp chính thức (BE — BE team cần làm)

Xem ticket: `tickets/backend/BE_SEMINAR_NULLABLE_ENDTIME.md`

Tóm tắt:

1. `POST /api/Seminar` → `endTime` trở thành **nullable** (`endTime?: string | null`).
2. Thêm endpoint (ví dụ `POST /api/Seminar/{id}/complete`) để lecturer chủ động kết thúc seminar. Endpoint này ghi `endTime = DateTime.UtcNow` và flip status sang `Completed`.
3. Khi BE fix xong:
   - FE **bỏ** việc gửi placeholder → `endTime` không có trong request body.
   - FE thêm nút **"Mark as Completed"** trên seminar card / detail.
   - Khi click → gọi endpoint mới.
   - `deriveEffectiveStatus()` tự động hoạt động đúng: `endTime = now` → `COMPLETED`, `endTime = null` → giữ nguyên `UPCOMING/IN PROGRESS`.

### Contract mới kỳ vọng

```ts
// POST /api/Seminar — endTime nullable
interface SeminarCreateRequest {
  startTime: string;
  endTime?: string | null;  // optional, nullable
  content: string;
  // ...
}

// POST /api/Seminar/{id}/complete — lecturer ends seminar
// Response: SeminarResponse với endTime = now, status = "Completed"

// Seminar card / detail UI
// Nút "Mark as Completed" chỉ hiển thị cho owner khi:
//   effectiveStatus === 'UPCOMING' || effectiveStatus === 'IN PROGRESS'
```

---

# 56. FE implementation order

Recommended thứ tự:

```text
1. Fix Seminar TypeScript types
2. Fix canonical API endpoints
3. Owner list + detail
4. Researcher owner flow
5. Participant invitation/detail
6. Dynamic feedback form owner
7. Dynamic feedback participant
8. Raw feedback owner
9. Stats
10. Feedback reminder
11. AI Feedback Summary
12. AI Audio Summary
13. Error/loading states
14. Regression Suggested Invitees
```

---

# 57. Acceptance Criteria — FE

- [ ] Lecturer xem đúng Seminar mình tạo.
- [ ] Researcher xem đúng Seminar mình tạo, không bị đưa vào participant-only flow.
- [ ] Owner create/update/delete Seminar được.
- [ ] Owner tạo dynamic feedback form gồm rating/text được.
- [ ] FE dùng stable `question.id`.
- [ ] Participant được mời GET feedback form được.
- [ ] `DECLINED` không mở được Seminar Detail/feedback form.
- [ ] Participant submit rating + text được.
- [ ] Participant submit lại = edit feedback.
- [ ] Participant chỉ thấy raw feedback của chính mình.
- [ ] Owner thấy raw feedback của tất cả participant.
- [ ] Owner raw feedback render từ `participant.feedbackJson`.
- [ ] FE không dùng `participantEvaluation` làm model chính.
- [ ] FE không dùng invitation status làm source duy nhất cho submitted feedback.
- [ ] Stats render total/submitted/pending/declined/completion.
- [ ] Không render `averageScore` từ API stats.
- [ ] Send Reminder gọi đúng `/reminders/send`.
- [ ] Generate AI Feedback gọi `/summarize-feedback`.
- [ ] AI feedback render từ `Seminar.feedbackJson`.
- [ ] Audio summary render từ `Seminar.aiSummary`.
- [ ] FE không gọi API save `aiSummary` riêng sau summarize-audio.
- [ ] Audio 409 có confirm replace flow.
- [ ] Suggested Invitees vẫn hoạt động.
- [ ] Loading state của Audio AI và Feedback AI tách riêng.
- [ ] Error message ưu tiên `response.data.message`.
- [ ] Không regression create/update/invite Seminar cũ.

---

# 58. Quick Reference

```text
FORM CONFIG
Seminars.feedback

PARTICIPANT RAW ANSWERS
SeminarParticipants.FeedbackJson

AI FEEDBACK RESULT
Seminars.FeedbackJson

AI AUDIO RESULT
Seminars.aiSummary
```

Canonical FE calls:

```text
GET    /api/Seminar
GET    /api/Seminar/{id}

POST   /api/Seminar
PUT    /api/Seminar/{id}
DELETE /api/Seminar/{id}

GET    /api/Seminar/suggested-invitees
POST   /api/Seminar/{id}/invite

GET    /api/Seminar/{id}/feedback-form
PUT    /api/Seminar/{id}/feedback-form

POST   /api/Seminar/{id}/feedback
GET    /api/Seminar/{id}/feedback

GET    /api/Seminar/{id}/stats
POST   /api/Seminar/{id}/reminders/send

POST   /api/Seminar/{id}/summarize-feedback
POST   /api/Seminar/{id}/summarize-audio
```

---

# 59. One-line data flow

```text
Owner creates Seminar
→ Seminars

Owner configures Feedback Form
→ Seminars.feedback

Participant submits rating/text
→ SeminarParticipants.FeedbackJson

Owner generates Feedback AI
→ Gemini receives TEXT only + question context
→ Seminars.FeedbackJson

Owner uploads Seminar audio/video
→ Gemini
→ Seminars.aiSummary

GET /api/Seminar/{id}
→ FE receives the combined Seminar state with privacy masking
```
