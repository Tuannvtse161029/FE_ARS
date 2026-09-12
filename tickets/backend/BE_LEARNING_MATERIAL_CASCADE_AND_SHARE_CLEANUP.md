# Backend Ticket: Xử lý Cascade Delete & Vòng đời Chia sẻ Tài liệu (Learning Material & Shared Material)

## 1. Mức độ ưu tiên
**High (Cao)** — Nghiệp vụ chia sẻ tài liệu giữa các Giảng viên và tính toàn vẹn dữ liệu khi xóa tài liệu gốc.

---

## 2. Vấn đề nghiệp vụ (Problem Statement)

Hiện tại, khi Giảng viên A chia sẻ một tài liệu (`LearningMaterial`) cho Giảng viên B, hệ thống tạo một bản ghi trong bảng `SharedMaterial` (`paperId` trỏ tới `learningMaterialId`).

Có 3 vấn đề phát sinh khi xử lý nghiệp vụ:

1. **Khi Giảng viên A xóa tài liệu gốc (`DELETE /api/LearningMaterial/{id}`):**
   - Nếu trong bảng `SharedMaterials` vẫn còn các bản ghi chia sẻ liên kết tới tài liệu này, CSDL có thể gặp lỗi khóa ngoại (Foreign Key Constraint Violation) **hoặc** để lại các bản ghi chia sẻ "mồ côi" (orphaned records).
   - Khi đó, Giảng viên B vẫn nhìn thấy bản ghi chia sẻ ở Tab "Được chia sẻ với tôi", nhưng tài liệu gốc không còn tồn tại, dẫn tới lỗi khi mở link (404) hoặc hiển thị dữ liệu rác.
2. **Khi Giảng viên A thu hồi / kết thúc chia sẻ (`End sharing`):**
   - Cần cập nhật trạng thái bản ghi `SharedMaterial` thành `ENDED` (hoặc `REVOKED`), và phía BE khi trả danh sách tài liệu thư viện cho Giảng viên B phải loại trừ các bản ghi có trạng thái này.
3. **Quyền truy cập danh sách Giảng viên để chọn người nhận:**
   - Hiện tại `GET /api/User?role=Lecturer` bị trả về `403 Forbidden` đối với tài khoản Giảng viên vì endpoint `/api/User` đang phân quyền Admin-only.

---

## 3. Yêu cầu chi tiết cho Backend (BE Specifications)

### 3.1. Xử lý khi Xóa tài liệu gốc (`DELETE /api/LearningMaterial/{id}`)

Khi nhận request `DELETE /api/LearningMaterial/{id}`:

**Phương án khuyến nghị (Cascade / Cleanup):**
1. **Kiểm tra ràng buộc sử dụng**:
   - Nếu tài liệu đang được liên kết trong các Đề tài nghiên cứu (`ResearchTopics`) hoặc Giai đoạn báo cáo (`PhasedReports`): Trả về `400 Bad Request` hoặc `409 Conflict` kèm thông báo: *"Tài liệu đang được sử dụng trong đề tài nghiên cứu, không thể xóa."*
2. **Dọn dẹp quan hệ chia sẻ**:
   - Tự động xóa (Cascade Delete) các bản ghi `SharedMaterial` liên quan:
     ```sql
     DELETE FROM SharedMaterials WHERE paperId = @learningMaterialId OR learningMaterialId = @learningMaterialId;
     ```
   - **HOẶC** chuyển trạng thái thành `ENDED`:
     ```sql
     UPDATE SharedMaterials SET status = 'ENDED' WHERE (paperId = @learningMaterialId OR learningMaterialId = @learningMaterialId) AND status IN ('PENDING', 'ACCEPTED', 'ACTIVE');
     ```
3. **Xóa tài liệu gốc**:
   - Xóa bản ghi trong `LearningMaterials`.
   - Trả về `200 OK` hoặc `204 No Content`.

---

### 3.2. Hỗ trợ đầy đủ trạng thái vòng đời trong `PUT /api/SharedMaterial/{id}`

Endpoint `PUT /api/SharedMaterial/{id}` cần chấp nhận cập nhật các trạng thái:
- `ACCEPTED`: Giảng viên B đồng ý nhận tài liệu.
- `DECLINED`: Giảng viên B từ chối nhận tài liệu.
- `ENDED`: Giảng viên A chủ động thu hồi/kết thúc chia sẻ.
- `EXPIRED`: Đã quá 30 ngày kể từ ngày chia sẻ (`sharedAt`).

**Payload mẫu:**
```json
{
  "lecturerId": 12,
  "paperId": 45,
  "sharedWithColleagueId": 34,
  "sharedAt": "2026-09-01T08:00:00.000Z",
  "status": "ENDED"
}
```

---

### 3.3. Endpoint `DELETE /api/SharedMaterial/{id}`

- Cho phép Giảng viên A (Người chia sẻ) hoặc Admin xóa cứng bản ghi chia sẻ nếu cần.
- Kiểm tra quyền: Chỉ cho phép người tạo (`lecturerId`) hoặc Admin thực hiện. Nếu Giảng viên khác gọi thì trả về `403 Forbidden`.

---

### 3.4. Mở quyền lấy danh sách Giảng viên đồng nghiệp

Để phục vụ modal chọn đồng nghiệp khi chia sẻ:
- **Phương án 1**: Cho phép Role `Lecturer` gọi `GET /api/User?role=Lecturer&pageNumber=1&pageSize=100`.
- **Phương án 2**: Cung cấp endpoint dành riêng cho Giảng viên: `GET /api/Lecturer` trả về danh sách `{ id, fullName, email }`.

---

## 4. Tiêu chí nghiệm thu (Acceptance Criteria)

- [ ] Khi xóa một `LearningMaterial` qua `DELETE /api/LearningMaterial/{id}`, không bị lỗi khóa ngoại CSDL và toàn bộ bản ghi `SharedMaterial` liên quan được dọn dẹp sạch sẽ.
- [ ] Giảng viên A gọi `PUT /api/SharedMaterial/{id}` với `status: 'ENDED'` thành công.
- [ ] Giảng viên B gọi `GET /api/SharedMaterial` không còn thấy tài liệu đã bị xóa gốc hoặc tài liệu đã `ENDED` trong thư viện của mình.
- [ ] Giảng viên có thể gọi API lấy danh sách đồng nghiệp mà không bị lỗi `403 Forbidden`.
