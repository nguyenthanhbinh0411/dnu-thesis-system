# Hướng Dẫn Tạo Hội Đồng Tự Động - API Payload cho Frontend

## 📋 Mục Đích
Tài liệu này mô tả **cấu trúc request payload** cho endpoint tạo hội đồng tự động với các tham số mới: **date range** và **daily council limit**.

---

## 🔄 Endpoint

```
POST /api/defense-periods/{periodId}/commands/generate-councils
Header: Idempotency-Key: <optional-unique-key>
```

---

## 📦 Request Payload Structure

### Cấu Trúc Chung

```json
{
  "selectedTopicCodes": [],
  "selectedLecturerCodes": [],
  "selectedRooms": [],
  "generationStartDate": "2026-05-08T00:00:00Z",
  "generationEndDate": "2026-05-20T00:00:00Z",
  "maxCouncilsPerDay": 3,
  "tags": [],
  "strategy": {
    "groupByTag": true,
    "maxPerSession": 4,
    "prioritizeMatchTag": true,
    "heuristicWeights": null
  },
  "constraints": {
    "avoidSupervisorConflict": true,
    "avoidLecturerOverlap": true,
    "requireRoles": ["CT", "UVTK", "UVPB"]
  },
  "idempotencyKey": "optional-idempotency-key"
}
```

---

## 🆕 Tham Số Mới (NEW)

### 1. `generationStartDate` (DateTime?)
- **Mô tả**: Ngày bắt đầu tạo hội đồng (nếu null thì dùng `period.StartDate`)
- **Kiểu dữ liệu**: `DateTime` (ISO 8601 format), hoặc null
- **Mặc định**: null → dùng StartDate của đợt bảo vệ
- **Ví dụ**: `"2026-05-08T00:00:00Z"`

### 2. `generationEndDate` (DateTime?)
- **Mô tả**: Ngày kết thúc tạo hội đồng (nếu null thì dùng `period.EndDate`)
- **Kiểu dữ liệu**: `DateTime` (ISO 8601 format), hoặc null
- **Mặc định**: null → dùng EndDate của đợt bảo vệ
- **Ví dụ**: `"2026-05-20T00:00:00Z"`

### 3. `maxCouncilsPerDay` (int)
- **Mô tả**: Số lượng hội đồng tối đa mỗi ngày (nếu 0 thì không giới hạn)
- **Kiểu dữ liệu**: `int` [0-100]
- **Mặc định**: 0 (không giới hạn)
- **Ví dụ**: `3` = tối đa 3 hội đồng/ngày
- **Lưu ý**: Nếu vượt quá giới hạn → lỗi `UC2.2.DAILY_COUNCIL_LIMIT_EXCEEDED`

---

## 📝 Tham Số Hiện Tại

| Tham Số | Kiểu | Bắt Buộc | Mô Tả |
|---------|------|----------|-------|
| `selectedTopicCodes` | `string[]` | ✅ Có | Danh sách mã đề tài (tối thiểu 1) |
| `selectedLecturerCodes` | `string[]` | ✅ Có | Danh sách mã giảng viên (tối thiểu 1) |
| `selectedRooms` | `string[]` | ❌ Không | Danh sách phòng (nếu rỗng thì dùng từ config) |
| `tags` | `string[]` | ❌ Không | Danh sách tag ưu tiên (nếu rỗng thì dùng từ config) |
| `strategy` | `object` | ❌ Không | Chiến lược tạo (grouping, priority, heuristic) |
| `constraints` | `object` | ❌ Không | Ràng buộc (supervisor, overlap, roles) |
| `idempotencyKey` | `string` | ❌ Không | Khóa để phòng truy vấn lặp (replay) |

---

## 💡 Ví Dụ Payload

### Example 1: Tạo hội đồng tối đa 3 hội/ngày trong khoảng 08/05 - 20/05/2026

```json
{
  "selectedTopicCodes": [
    "T001", "T002", "T003", "T004", "T005", "T006",
    "T007", "T008", "T009", "T010", "T011", "T012"
  ],
  "selectedLecturerCodes": ["L001", "L002", "L003", "L004", "L005", "L006"],
  "selectedRooms": ["A101", "A102", "A103"],
  "generationStartDate": "2026-05-08T00:00:00Z",
  "generationEndDate": "2026-05-20T00:00:00Z",
  "maxCouncilsPerDay": 3,
  "tags": ["Web", "Mobile"],
  "strategy": {
    "groupByTag": true,
    "maxPerSession": 3,
    "prioritizeMatchTag": true,
    "heuristicWeights": {
      "tagMatchWeight": 0.5,
      "workloadWeight": 0.2,
      "fairnessWeight": 0.15,
      "consecutiveCommitteePenaltyWeight": 0.15
    }
  },
  "constraints": {
    "avoidSupervisorConflict": true,
    "avoidLecturerOverlap": true,
    "requireRoles": ["CT", "UVTK", "UVPB"]
  },
  "idempotencyKey": "gen-councils-2026-05-08-batch1"
}
```

### Example 2: Dùng mặc định (không có date range / daily limit)

```json
{
  "selectedTopicCodes": ["T001", "T002", "T003", "T004", "T005", "T006"],
  "selectedLecturerCodes": ["L001", "L002", "L003", "L004", "L005"],
  "selectedRooms": ["A101", "A102"],
  "generationStartDate": null,
  "generationEndDate": null,
  "maxCouncilsPerDay": 0,
  "tags": [],
  "strategy": {},
  "constraints": {},
  "idempotencyKey": null
}
```

### Example 3: Chỉ giới hạn ngày bắt đầu, không giới hạn ngày kết thúc và số lượng/ngày

```json
{
  "selectedTopicCodes": ["T001", "T002", "T003", "T004", "T005", "T006"],
  "selectedLecturerCodes": ["L001", "L002", "L003"],
  "selectedRooms": ["A101"],
  "generationStartDate": "2026-05-10T00:00:00Z",
  "generationEndDate": null,
  "maxCouncilsPerDay": 0,
  "tags": [],
  "strategy": {
    "maxPerSession": 4
  },
  "constraints": {
    "avoidSupervisorConflict": true
  }
}
```

---

## 🎯 Logic Hoạt Động

### Quy Trình Tạo Hội Đồng

```
1. Kiểm tra tiên quyết (period finalized, config confirmed, etc.)
   ↓
2. Xây dựng khoảng ngày:
   - Nếu generationStartDate/EndDate → dùng chúng
   - Nếu null → dùng period.StartDate/EndDate
   ↓
3. Lặp qua từng nhóm đề tài:
   - Kiểm tra số hội đồng trong ngày (nếu maxCouncilsPerDay > 0)
   - Nếu >= maxCouncilsPerDay → Lỗi DAILY_COUNCIL_LIMIT_EXCEEDED
   - Nếu < maxCouncilsPerDay → Tạo hội đồng mới
   ↓
4. Xếp giảng viên theo heuristic (tag, workload, fairness, consecutive)
   ↓
5. Kiểm tra ràng buộc (supervisor, lecturer-day-conflict, roles)
   ↓
6. Lưu hội đồng + NotifyCouncilListLocked
```

---

## ⚠️ Lỗi Có Thể Xảy Ra

| Error Code | Message | Nguyên Nhân |
|-----------|---------|-----------|
| `UC2.2.GENERATION_START_DATE_INVALID` | Invalid generation start date | StartDate không hợp lệ |
| `UC2.2.GENERATION_END_DATE_INVALID` | Invalid generation end date | EndDate < StartDate hoặc EndDate không hợp lệ |
| `UC2.2.DAILY_COUNCIL_LIMIT_EXCEEDED` | Vượt quá giới hạn X hội đồng/ngày vào YYYY-MM-DD | Số hội đồng vượt maxCouncilsPerDay |
| `UC2.2.ROOM_DATE_CAPACITY_EXCEEDED` | Không còn slot phòng/ngày trống | Không đủ phòng/ngày |
| `UC2.3.LECTURER_DAY_CONFLICT` | Giảng viên tham gia 2+ hội đồng cùng ngày | Xung đột 1 người 1 ngày |
| `UC2.3.LECTURER_SUPERVISOR_CONFLICT` | GVHD của sinh viên không được nằm trong hội đồng | Vi phạm ràng buộc GVHD |

---

## ✅ Điều Kiện Thành Công

Hội đồng được tạo thành công khi:

1. ✅ Đợt bảo vệ **chưa finalize**
2. ✅ Khóa **lecturer capabilities**
3. ✅ Xác nhận **council config** (members/topic per session)
4. ✅ Có ít nhất **1 phòng** được chọn
5. ✅ Có ít nhất **1 đề tài + 1 giảng viên** được chọn
6. ✅ Không vượt **daily council limit** (nếu có)
7. ✅ **Tất cả đề tài + giảng viên** đều hợp lệ (trong scope)
8. ✅ **Không có xung đột**:
   - Giảng viên hướng dẫn không nằm trong hội đồng của SV mình
   - Giảng viên không tham gia 2 hội đồng cùng ngày

---

## 🚀 Best Practices for Frontend

### 1. **Luôn đặt Idempotency-Key**
```javascript
const idempotencyKey = `gen-${periodId}-${Date.now()}`;
// Gửi request với header: Idempotency-Key: idempotencyKey
```

### 2. **Validate Date Range Trước Khi Gửi**
```javascript
if (startDate > endDate) {
  alert("Ngày bắt đầu phải trước ngày kết thúc!");
  return;
}
```

### 3. **Ghi Nhớ Daily Limit**
```javascript
// Nếu muốn 3 hội đồng/ngày:
maxCouncilsPerDay: 3

// Nếu không giới hạn:
maxCouncilsPerDay: 0
```

### 4. **Kiểm Tra AvoidLecturerOverlap**
```javascript
// Nên set true để tránh xung đột:
constraints: {
  avoidLecturerOverlap: true,  // 1 giảng viên 1 ngày
  avoidSupervisorConflict: true
}
```

### 5. **Xử Lý Response**
```javascript
// Success
{
  statusCode: 200,
  data: [
    {
      councilId: 1,
      councilCode: "HĐ-001",
      defenseDateText: "08-05-2026",
      status: "Draft" | "Warning" | "Ready"
    }
  ],
  warnings: []
}

// Failure
{
  statusCode: 400,
  code: "UC2.2.DAILY_COUNCIL_LIMIT_EXCEEDED",
  message: "Vượt quá giới hạn 3 hội đồng/ngày vào 2026-05-08"
}
```

---

## 📊 Ví Dụ Tính Toán Dung Lượng

**Đầu vào:**
- Phòng: 3 (A101, A102, A103)
- Ngày: 13 ngày (08/05 - 20/05/2026)
- Phiên/ngày: 2 (sáng + chiều)
- Đề tài/phiên: 3
- Hội đồng/ngày: 2 (maxCouncilsPerDay = 2)

**Tính toán:**
```
Dung lượng = Phòng × Ngày × 2 phiên × Đề tài/phiên
           = 3 × 13 × 2 × 3
           = 234 đề tài

Nhưng với maxCouncilsPerDay = 2:
Hội đồng/ngày = 2
Đề tài/hội đồng = 2 phiên × 3 đề tài/phiên = 6 đề tài

Thực tế dung lượng = 2 hội/ngày × 6 đề tài × 13 ngày
                   = 156 đề tài
```

---

## 📞 Support

Nếu có lỗi, hãy kiểm tra:
1. Tất cả topic codes có hợp lệ không? (Check Sync Status)
2. Tất cả lecturer codes có nằm trong DefenseTermLecturers không?
3. Phòng có tồn tại không?
4. Date range có hợp lệ không (startDate < endDate)?
5. Đã xác nhận council config chưa?
6. Đã khóa lecturer capabilities chưa?

---

**Tài liệu cập nhật**: 2026-05-08  
**Version**: v2 (Có date range + daily limit)
