using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ThesisManagement.Api.Data;
using ThesisManagement.Api.DTOs;
using ThesisManagement.Api.Models;

namespace ThesisManagement.Api.Services
{
    public class CommitteeAssignmentService : ICommitteeAssignmentService
    {
        private readonly ApplicationDbContext _db;
        private readonly IUnitOfWork _uow;
        private readonly ILogger<CommitteeAssignmentService> _logger;

        public CommitteeAssignmentService(ApplicationDbContext db, IUnitOfWork uow, ILogger<CommitteeAssignmentService> logger)
        {
            _db = db;
            _uow = uow;
            _logger = logger;
        }

        private static string? FormatTimeSpan(TimeSpan? value)
        {
            return value.HasValue ? value.Value.ToString(@"hh\:mm") : null;
        }

        private static List<string> SplitValues(string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw))
            {
                return new List<string>();
            }

            return raw.Split(new[] { ',', ';', '|' }, StringSplitOptions.RemoveEmptyEntries)
                .Select(s => s.Trim())
                .Where(s => !string.IsNullOrEmpty(s))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
        }

        private static (TimeSpan Start, TimeSpan End) ResolveSlot(string? startText, string? endText, int session)
        {
            var defaultStart = session == 1 ? new TimeSpan(7, 30, 0) : new TimeSpan(13, 30, 0);
            var defaultEnd = defaultStart.Add(TimeSpan.FromHours(1));

            var start = TimeSpan.Zero;
            var end = TimeSpan.Zero;

            if (!string.IsNullOrWhiteSpace(startText) && TimeSpan.TryParse(startText, out var parsedStart))
            {
                start = parsedStart;
            }

            if (!string.IsNullOrWhiteSpace(endText) && TimeSpan.TryParse(endText, out var parsedEnd))
            {
                end = parsedEnd;
            }

            if (start == TimeSpan.Zero && end == TimeSpan.Zero)
            {
                start = defaultStart;
                end = defaultEnd;
            }
            else if (start != TimeSpan.Zero && end == TimeSpan.Zero)
            {
                end = start.Add(TimeSpan.FromHours(1));
            }
            else if (start == TimeSpan.Zero && end != TimeSpan.Zero)
            {
                start = end.Subtract(TimeSpan.FromHours(1));
            }

            if (end <= start)
            {
                end = start.Add(TimeSpan.FromHours(1));
            }

            return (start, end);
        }

        private static bool IsOverlap(TimeSpan aStart, TimeSpan aEnd, TimeSpan bStart, TimeSpan bEnd)
        {
            return aStart < bEnd && bStart < aEnd;
        }

        private static bool IsEligibleChairDegree(string? degree)
        {
            if (string.IsNullOrWhiteSpace(degree))
            {
                return false;
            }

            return degree.Contains("Tiến sĩ", StringComparison.OrdinalIgnoreCase)
                || degree.Contains("Phó giáo sư", StringComparison.OrdinalIgnoreCase)
                || degree.Contains("PGS", StringComparison.OrdinalIgnoreCase);
        }

        private async Task ReplaceCommitteeMembersInternalAsync(Committee committee, List<(LecturerProfile Profile, string Role, bool IsChair)> replacements, CancellationToken cancellationToken)
        {
            var existingMembers = await _db.CommitteeMembers
                .Where(cm => cm.CommitteeCode == committee.CommitteeCode)
                .ToListAsync(cancellationToken);

            if (existingMembers.Count > 0)
            {
                _db.CommitteeMembers.RemoveRange(existingMembers);
            }

            var now = DateTime.UtcNow;
            foreach (var entry in replacements)
            {
                await _uow.CommitteeMembers.AddAsync(new CommitteeMember
                {
                    CommitteeID = committee.CommitteeID,
                    CommitteeCode = committee.CommitteeCode,
                    MemberLecturerProfileID = entry.Profile.LecturerProfileID,
                    MemberLecturerCode = entry.Profile.LecturerCode,
                    MemberUserID = entry.Profile.User?.UserID,
                    MemberUserCode = entry.Profile.User?.UserCode,
                    Role = entry.Role,
                    IsChair = entry.IsChair,
                    CreatedAt = now,
                    LastUpdated = now
                });
            }
        }

        private async Task RefreshCommitteeSessionsAsync(Committee committee, CancellationToken cancellationToken)
        {
            var rawAssignments = await _db.DefenseAssignments
                .Where(a => a.CommitteeCode == committee.CommitteeCode)
                .Select(a => new { a.Session, a.ScheduledAt })
                .ToListAsync(cancellationToken);

            var normalized = new List<(int Session, DateTime? ScheduledAt)>();
            foreach (var entry in rawAssignments)
            {
                if (entry.Session is int session && session > 0)
                {
                    normalized.Add((session, entry.ScheduledAt));
                }
            }

            var groups = normalized
                .GroupBy(a => a.Session)
                .Select(g => new
                {
                    Session = g.Key,
                    Count = g.Count(),
                    ScheduledAt = g.Min(a => a.ScheduledAt)
                })
                .ToList();
            // Previously this method synchronized CommitteeSessions table from DefenseAssignments.
            // CommitteeSessions is deprecated; keep compute-only behavior (no DB writes).
            var now = DateTime.UtcNow;
            foreach (var group in groups)
            {
                _logger.LogInformation("Committee {code} session {session}: count={count}, scheduledAt={scheduled}", committee.CommitteeCode, group.Session, group.Count, group.ScheduledAt);
            }
        }

        // ============ INIT / CODE ============
        public async Task<ApiResponse<CommitteeCreateInitDto>> GetCommitteeCreateInitAsync(CancellationToken cancellationToken = default)
        {
            try
            {
                var rooms = await _db.Committees.AsNoTracking()
                    .Where(c => c.Room != null && c.Room != string.Empty)
                    .Select(c => c.Room!)
                    .Distinct().OrderBy(x => x)
                    .ToListAsync(cancellationToken);
                var suggestedTags = await _db.Tags.AsNoTracking().OrderBy(t => t.TagName).Select(t => t.TagCode).ToListAsync(cancellationToken);

                var nextCode = await GenerateCommitteeCodeAsync(cancellationToken);
                var payload = new CommitteeCreateInitDto
                {
                    NextCode = nextCode,
                    DefaultDefenseDate = DateTime.UtcNow.Date.AddDays(7),
                    Rooms = rooms,
                    SuggestedTags = suggestedTags
                };

                var res = ApiResponse<CommitteeCreateInitDto>.SuccessResponse(payload);
                res.HttpStatusCode = StatusCodes.Status200OK;
                return res;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "get-init failed");
                return ApiResponse<CommitteeCreateInitDto>.Fail("Không thể khởi tạo dữ liệu", StatusCodes.Status500InternalServerError);
            }
        }

        private async Task<string> GenerateCommitteeCodeAsync(CancellationToken cancellationToken)
        {
            string today = DateTime.Now.ToString("yyyyMMdd");
            string prefix = $"COM{today}";

            // Lấy tất cả các mã bắt đầu bằng prefix trong ngày hiện tại
            var lastCommittee = await _db.Committees.AsNoTracking()
                .Where(c => c.CommitteeCode.StartsWith(prefix))
                .OrderByDescending(c => c.CommitteeCode)
                .FirstOrDefaultAsync(cancellationToken);

            int nextNumber = 1;

            if (lastCommittee != null)
            {
                // Cắt phần số ở cuối để +1
                string lastCode = lastCommittee.CommitteeCode;
                if (lastCode.Length > prefix.Length && int.TryParse(lastCode.Substring(prefix.Length), out int lastNum))
                {
                    nextNumber = lastNum + 1;
                }
            }

            string newCode = $"{prefix}{nextNumber:D3}"; // D3 -> padding 3 số 001,002,...
            return newCode;
        }

        public async Task<ApiResponse<CommitteeDetailDto>> CreateCommitteeAsync(CommitteeCreateRequestDto request, CancellationToken cancellationToken = default)
        {
            if (request == null)
            {
                return ApiResponse<CommitteeDetailDto>.Fail("Dữ liệu không hợp lệ", StatusCodes.Status400BadRequest);
            }

            // Require CommitteeCode from client - must be provided
            var code = request.CommitteeCode?.Trim() ?? throw new ArgumentException("CommitteeCode is required");

            await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);
            try
            {
                var exists = await _db.Committees.AsNoTracking().AnyAsync(c => c.CommitteeCode == code, cancellationToken);
                if (exists)
                {
                    return ApiResponse<CommitteeDetailDto>.Fail("Mã hội đồng đã tồn tại", StatusCodes.Status409Conflict);
                }

                var now = DateTime.UtcNow;
                var committee = new Committee
                {
                    CommitteeCode = code,
                    Name = string.IsNullOrWhiteSpace(request.Name) ? code : request.Name!.Trim(),
                    DefenseDate = request.DefenseDate,
                    Room = string.IsNullOrWhiteSpace(request.Room) ? null : request.Room!.Trim(),
                    Status = "Sắp diễn ra",
                    CreatedAt = now,
                    LastUpdated = now
                };

                await _uow.Committees.AddAsync(committee);
                await _uow.SaveChangesAsync();

                var normalizedTags = (request.TagCodes ?? new List<string>())
                    .Where(x => !string.IsNullOrWhiteSpace(x))
                    .Select(x => x.Trim())
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();

                if (normalizedTags.Count > 0)
                {
                    var tags = await _db.Tags.AsNoTracking()
                        .Where(t => normalizedTags.Contains(t.TagCode))
                        .Select(t => new { t.TagID, t.TagCode })
                        .ToListAsync(cancellationToken);

                    var missing = normalizedTags
                        .Where(codeValue => tags.All(t => !string.Equals(t.TagCode, codeValue, StringComparison.OrdinalIgnoreCase)))
                        .ToList();

                    if (missing.Count > 0)
                    {
                        return ApiResponse<CommitteeDetailDto>.Fail($"Không tìm thấy tag: {string.Join(", ", missing)}", StatusCodes.Status400BadRequest);
                    }

                    // Check existing committee tags to avoid duplicates
                    var existingTagIds = await _db.CommitteeTags
                        .Where(ct => ct.CommitteeCode == committee.CommitteeCode)
                        .Select(ct => ct.TagID)
                        .ToListAsync(cancellationToken);

                    var newTags = tags.Where(t => !existingTagIds.Contains(t.TagID)).ToList();

                    foreach (var tag in newTags)
                    {
                        await _uow.CommitteeTags.AddAsync(new CommitteeTag
                        {
                            CommitteeID = committee.CommitteeID,
                            CommitteeCode = committee.CommitteeCode,
                            TagID = tag.TagID,
                            TagCode = tag.TagCode,
                            CreatedAt = now
                        });
                    }

                    await _uow.SaveChangesAsync();
                }

                await tx.CommitAsync(cancellationToken);

                var detail = await GetCommitteeDetailAsync(committee.CommitteeCode, cancellationToken);
                detail.HttpStatusCode = StatusCodes.Status201Created;
                return detail;
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync(cancellationToken);
                _logger.LogError(ex, "create committee failed");
                return ApiResponse<CommitteeDetailDto>.Fail("Không thể tạo hội đồng", StatusCodes.Status500InternalServerError);
            }
        }

        public async Task<ApiResponse<CommitteeDetailDto>> UpdateCommitteeAsync(string committeeCode, CommitteeUpdateRequestDto request, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(committeeCode)) return ApiResponse<CommitteeDetailDto>.Fail("Mã hội đồng không hợp lệ", StatusCodes.Status400BadRequest);
            await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);
            try
            {
                var committee = await _db.Committees.FirstOrDefaultAsync(c => c.CommitteeCode == committeeCode, cancellationToken);
                if (committee == null) return ApiResponse<CommitteeDetailDto>.Fail("Không tìm thấy hội đồng", StatusCodes.Status404NotFound);

                if (!string.IsNullOrWhiteSpace(request.Name)) committee.Name = request.Name!.Trim();
                if (request.DefenseDate.HasValue) committee.DefenseDate = request.DefenseDate;
                if (request.Room != null) committee.Room = request.Room?.Trim();
                committee.LastUpdated = DateTime.UtcNow;

                // Replace tags if provided
                if (request.TagCodes != null)
                {
                    var existing = await _db.CommitteeTags.Where(ct => ct.CommitteeCode == committeeCode).ToListAsync(cancellationToken);
                    if (existing.Count > 0) _db.CommitteeTags.RemoveRange(existing);

                    var normalized = request.TagCodes.Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x.Trim()).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
                    if (normalized.Count > 0)
                    {
                        var tags = await _db.Tags.AsNoTracking().Where(t => normalized.Contains(t.TagCode)).Select(t => new { t.TagID, t.TagCode }).ToListAsync(cancellationToken);
                        foreach (var tag in tags)
                        {
                            await _uow.CommitteeTags.AddAsync(new CommitteeTag
                            {
                                CommitteeID = committee.CommitteeID,
                                CommitteeCode = committee.CommitteeCode,
                                TagID = tag.TagID,
                                TagCode = tag.TagCode,
                                CreatedAt = DateTime.UtcNow
                            });
                        }
                    }
                }

                // Replace members if provided
                if (request.Members != null)
                {
                    var normalizedMembers = request.Members.Where(m => m != null).ToList();
                    if (normalizedMembers.Count < 4)
                        return ApiResponse<CommitteeDetailDto>.Fail("Hội đồng phải có tối thiểu 4 thành viên", StatusCodes.Status400BadRequest);

                    var chairCount = normalizedMembers.Count(m => m.IsChair);
                    if (chairCount != 1)
                        return ApiResponse<CommitteeDetailDto>.Fail("Hội đồng phải có đúng 1 Chủ tịch", StatusCodes.Status400BadRequest);

                    var profileIds = normalizedMembers.Select(m => m.LecturerProfileId).Distinct().ToList();
                    var profiles = await _db.LecturerProfiles.Include(p => p.User).Where(p => profileIds.Contains(p.LecturerProfileID)).ToListAsync(cancellationToken);
                    if (profiles.Count != profileIds.Count)
                    {
                        return ApiResponse<CommitteeDetailDto>.Fail("Một hoặc nhiều giảng viên không tồn tại", StatusCodes.Status400BadRequest);
                    }

                    var replacements = new List<(LecturerProfile Profile, string Role, bool IsChair)>();
                    foreach (var input in normalizedMembers)
                    {
                        var profile = profiles.First(x => x.LecturerProfileID == input.LecturerProfileId);
                        if (input.IsChair && !IsEligibleChairDegree(profile.Degree))
                        {
                            return ApiResponse<CommitteeDetailDto>.Fail("Chủ tịch phải có học vị Tiến sĩ hoặc Phó giáo sư", StatusCodes.Status400BadRequest);
                        }

                        replacements.Add((profile, input.Role, input.IsChair));
                        }

                        // Server-side validation: prevent a lecturer from being member of more than one committee on the same day
                        if (!committee.DefenseDate.HasValue)
                        {
                            return ApiResponse<CommitteeDetailDto>.Fail("Vui lòng đặt ngày bảo vệ trước khi lưu thành viên", StatusCodes.Status400BadRequest);
                        }

                        var targetDate = committee.DefenseDate.Value.Date;
                        var lecturerCodes = replacements.Select(r => r.Profile.LecturerCode).Where(c => !string.IsNullOrWhiteSpace(c)).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
                        if (lecturerCodes.Count > 0)
                        {
                            var conflicts = await (from cm in _db.CommitteeMembers.AsNoTracking()
                                                   join c in _db.Committees.AsNoTracking() on cm.CommitteeCode equals c.CommitteeCode
                                                   where cm.MemberLecturerCode != null
                                                         && lecturerCodes.Contains(cm.MemberLecturerCode)
                                                         && cm.CommitteeCode != committee.CommitteeCode
                                                         && c.DefenseDate.HasValue && c.DefenseDate.Value.Date == targetDate
                                                   select new { cm.MemberLecturerCode, c.CommitteeCode }).ToListAsync(cancellationToken);

                            if (conflicts.Count > 0)
                            {
                                var grouped = conflicts.GroupBy(x => x.MemberLecturerCode, StringComparer.OrdinalIgnoreCase)
                                    .Select(g => new { Lecturer = g.Key, Committees = g.Select(v => v.CommitteeCode).Distinct().ToList() })
                                    .ToList();

                                var msgParts = grouped.Select(g => $"Giảng viên {g.Lecturer} đã được phân vào hội đồng: {string.Join(',', g.Committees)} trong cùng ngày {targetDate:dd/MM/yyyy}");
                                return ApiResponse<CommitteeDetailDto>.Fail(string.Join("; ", msgParts), StatusCodes.Status409Conflict);
                            }
                        }

                        await ReplaceCommitteeMembersInternalAsync(committee, replacements, cancellationToken);
                }

                var topicsTouched = false;

                // Sync topics (defense assignments) if provided
                if (request.Topics != null)
                {
                    topicsTouched = true;
                    // Load existing assignments for this committee
                    var existingAssignments = await _db.DefenseAssignments.Where(a => a.CommitteeCode == committeeCode).ToListAsync(cancellationToken);

                    // Normalize incoming
                    var incoming = request.Topics.Where(t => !string.IsNullOrWhiteSpace(t.TopicCode)).ToList();

                    // Remove assignments that are not present in incoming (topic removed)
                    var toRemove = existingAssignments.Where(e => !incoming.Any(i => string.Equals(i.TopicCode, e.TopicCode, StringComparison.OrdinalIgnoreCase))).ToList();
                    if (toRemove.Count > 0)
                    {
                        _db.DefenseAssignments.RemoveRange(toRemove);
                        // revert topic status
                        var removedTopicCodes = toRemove.Select(t => t.TopicCode!).Where(x => x != null).ToList();
                        var removedTopics = await _db.Topics.Where(t => removedTopicCodes.Contains(t.TopicCode)).ToListAsync(cancellationToken);
                        foreach (var t in removedTopics)
                        {
                            t.Status = "Đủ điều kiện bảo vệ";
                            t.LastUpdated = DateTime.UtcNow;
                        }
                    }

                    // Upsert incoming assignments
                    foreach (var inc in incoming)
                    {
                        var existing = existingAssignments.FirstOrDefault(e => string.Equals(e.TopicCode, inc.TopicCode, StringComparison.OrdinalIgnoreCase));
                        // parse times
                        TimeSpan? sTime = null, eTime = null;
                        if (!string.IsNullOrWhiteSpace(inc.StartTime) && TimeSpan.TryParse(inc.StartTime, out var ps)) sTime = ps;
                        if (!string.IsNullOrWhiteSpace(inc.EndTime) && TimeSpan.TryParse(inc.EndTime, out var pe)) eTime = pe;

                        if (existing == null)
                        {
                            // create new assignment
                            var topic = await _db.Topics.FirstOrDefaultAsync(t => t.TopicCode == inc.TopicCode, cancellationToken);
                            if (topic == null) throw new InvalidOperationException($"Topic not found: {inc.TopicCode}");

                            await _uow.DefenseAssignments.AddAsync(new DefenseAssignment
                            {
                                AssignmentCode = $"DA_{committee.CommitteeCode}_{topic.TopicCode}_{DateTime.UtcNow:yyyyMMddHHmmssfff}",
                                CommitteeCode = committee.CommitteeCode,
                                CommitteeID = committee.CommitteeID,
                                TopicCode = topic.TopicCode,
                                TopicID = topic.TopicID,
                                Session = inc.Session,
                                ScheduledAt = inc.ScheduledAt,
                                StartTime = sTime,
                                EndTime = eTime,
                                AssignedBy = "system",
                                AssignedAt = DateTime.UtcNow,
                                CreatedAt = DateTime.UtcNow,
                                LastUpdated = DateTime.UtcNow
                            });

                            topic.Status = "Đã phân hội đồng";
                            topic.LastUpdated = DateTime.UtcNow;
                        }
                        else
                        {
                            // update existing
                            existing.Session = inc.Session;
                            existing.ScheduledAt = inc.ScheduledAt;
                            existing.StartTime = sTime;
                            existing.EndTime = eTime;
                            existing.LastUpdated = DateTime.UtcNow;
                        }
                    }
                }

                await _uow.SaveChangesAsync();
                if (topicsTouched)
                {
                    // CommitteeSessions deprecated; no DB synchronization required. Log summary instead.
                    _logger.LogInformation("Topics touched for committee {code}, DefenseAssignments are authoritative.", committee.CommitteeCode);
                }
                await tx.CommitAsync(cancellationToken);
                return await GetCommitteeDetailAsync(committeeCode, cancellationToken);
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync(cancellationToken);
                _logger.LogError(ex, "update committee failed");
                return ApiResponse<CommitteeDetailDto>.Fail("Không thể cập nhật hội đồng", StatusCodes.Status500InternalServerError);
            }
        }

        public async Task<ApiResponse<CommitteeDetailDto>> SaveCommitteeMembersAsync(CommitteeMembersCreateRequestDto request, CancellationToken cancellationToken = default)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.CommitteeCode))
            {
                return ApiResponse<CommitteeDetailDto>.Fail("Mã hội đồng không hợp lệ", StatusCodes.Status400BadRequest);
            }

            var incomingMembers = request.Members?
                .Where(m => m != null)
                .ToList() ?? new List<CommitteeMemberInputDto>();

            if (incomingMembers.Count < 4)
            {
                return ApiResponse<CommitteeDetailDto>.Fail("Hội đồng phải có tối thiểu 4 thành viên", StatusCodes.Status400BadRequest);
            }

            // Some clients may omit IsChair and instead only provide the role string.
            // Treat a member as chair if IsChair == true OR Role equals "Chủ tịch" (case-insensitive).
            int chairCount = incomingMembers.Count(m => m.IsChair || string.Equals(m.Role?.Trim(), "Chủ tịch", StringComparison.OrdinalIgnoreCase));
            if (chairCount != 1)
            {
                return ApiResponse<CommitteeDetailDto>.Fail("Hội đồng phải có đúng 1 Chủ tịch", StatusCodes.Status400BadRequest);
            }

            var profileIds = incomingMembers.Select(m => m.LecturerProfileId).ToList();
            var distinctProfileIds = profileIds.Distinct().ToList();
            if (distinctProfileIds.Count != profileIds.Count)
            {
                return ApiResponse<CommitteeDetailDto>.Fail("Không được trùng lặp giảng viên trong hội đồng", StatusCodes.Status400BadRequest);
            }

            await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);
            try
            {
                var committee = await _db.Committees.FirstOrDefaultAsync(c => c.CommitteeCode == request.CommitteeCode, cancellationToken);
                if (committee == null)
                {
                    return ApiResponse<CommitteeDetailDto>.Fail("Không tìm thấy hội đồng", StatusCodes.Status404NotFound);
                }

                var profiles = await _db.LecturerProfiles.Include(p => p.User)
                    .Where(p => distinctProfileIds.Contains(p.LecturerProfileID))
                    .ToListAsync(cancellationToken);

                if (profiles.Count != distinctProfileIds.Count)
                {
                    return ApiResponse<CommitteeDetailDto>.Fail("Một hoặc nhiều giảng viên không tồn tại", StatusCodes.Status400BadRequest);
                }

                var profileMap = profiles.ToDictionary(p => p.LecturerProfileID);
                var replacements = new List<(LecturerProfile Profile, string Role, bool IsChair)>();

                foreach (var member in incomingMembers)
                {
                    if (!profileMap.TryGetValue(member.LecturerProfileId, out var profile))
                    {
                        return ApiResponse<CommitteeDetailDto>.Fail($"Không tìm thấy giảng viên với ID {member.LecturerProfileId}", StatusCodes.Status400BadRequest);
                    }

                    var role = member.Role?.Trim() ?? string.Empty;
                    if (string.IsNullOrWhiteSpace(role))
                    {
                        return ApiResponse<CommitteeDetailDto>.Fail("Vai trò của thành viên không được bỏ trống", StatusCodes.Status400BadRequest);
                    }

                    // Determine chair status from IsChair flag or role string
                    var isChairLocal = member.IsChair || string.Equals(role, "Chủ tịch", StringComparison.OrdinalIgnoreCase);
                    if (isChairLocal && !IsEligibleChairDegree(profile.Degree))
                    {
                        return ApiResponse<CommitteeDetailDto>.Fail("Chủ tịch phải có học vị Tiến sĩ hoặc Phó giáo sư", StatusCodes.Status400BadRequest);
                    }

                    replacements.Add((profile, role, isChairLocal));
                }

                // Server-side validation: prevent a lecturer from being member of more than one committee on the same day
                if (!committee.DefenseDate.HasValue)
                {
                    return ApiResponse<CommitteeDetailDto>.Fail("Vui lòng đặt ngày bảo vệ trước khi lưu thành viên", StatusCodes.Status400BadRequest);
                }

                var targetDate = committee.DefenseDate.Value.Date;
                var lecturerCodes = replacements.Select(r => r.Profile.LecturerCode).Where(c => !string.IsNullOrWhiteSpace(c)).Distinct(StringComparer.OrdinalIgnoreCase).ToList();

                if (lecturerCodes.Count > 0)
                {
                    var conflicts = await (from cm in _db.CommitteeMembers.AsNoTracking()
                                           join c in _db.Committees.AsNoTracking() on cm.CommitteeCode equals c.CommitteeCode
                                           where cm.MemberLecturerCode != null
                                                 && lecturerCodes.Contains(cm.MemberLecturerCode)
                                                 && cm.CommitteeCode != committee.CommitteeCode
                                                 && c.DefenseDate.HasValue && c.DefenseDate.Value.Date == targetDate
                                           select new { cm.MemberLecturerCode, c.CommitteeCode }).ToListAsync(cancellationToken);

                    if (conflicts.Count > 0)
                    {
                        var grouped = conflicts.GroupBy(x => x.MemberLecturerCode, StringComparer.OrdinalIgnoreCase)
                            .Select(g => new { Lecturer = g.Key, Committees = g.Select(v => v.CommitteeCode).Distinct().ToList() })
                            .ToList();

                        var msgParts = grouped.Select(g => $"Giảng viên {g.Lecturer} đã được phân vào hội đồng: {string.Join(',', g.Committees)} trong cùng ngày {targetDate:dd/MM/yyyy}");
                        return ApiResponse<CommitteeDetailDto>.Fail(string.Join("; ", msgParts), StatusCodes.Status409Conflict);
                    }
                }

                await ReplaceCommitteeMembersInternalAsync(committee, replacements, cancellationToken);
                committee.LastUpdated = DateTime.UtcNow;

                await _uow.SaveChangesAsync();
                await tx.CommitAsync(cancellationToken);

                var detail = await GetCommitteeDetailAsync(committee.CommitteeCode, cancellationToken);
                detail.HttpStatusCode = StatusCodes.Status200OK;
                return detail;
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync(cancellationToken);
                _logger.LogError(ex, "save committee members failed");
                return ApiResponse<CommitteeDetailDto>.Fail("Không thể lưu thành viên hội đồng", StatusCodes.Status500InternalServerError);
            }
        }

        public async Task<ApiResponse<CommitteeDetailDto>> UpdateCommitteeMembersAsync(CommitteeMembersUpdateRequestDto request, CancellationToken cancellationToken = default)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.CommitteeCode))
                return ApiResponse<CommitteeDetailDto>.Fail("Mã hội đồng không hợp lệ", StatusCodes.Status400BadRequest);

            var incomingMembers = request.Members?.Where(m => m != null && !string.IsNullOrWhiteSpace(m.LecturerCode)).ToList()
                ?? new List<CommitteeMemberRoleUpdateDto>();

            if (incomingMembers.Count < 4)
                return ApiResponse<CommitteeDetailDto>.Fail("Hội đồng phải có tối thiểu 4 thành viên", StatusCodes.Status400BadRequest);

            var chairCount = incomingMembers.Count(m => string.Equals(m.Role?.Trim(), "Chủ tịch", StringComparison.OrdinalIgnoreCase));
            if (chairCount != 1)
                return ApiResponse<CommitteeDetailDto>.Fail("Hội đồng phải có đúng 1 Chủ tịch", StatusCodes.Status400BadRequest);

            var lecturerCodes = incomingMembers.Select(m => m.LecturerCode.Trim()).ToList();
            var distinctCodes = lecturerCodes.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
            if (distinctCodes.Count != lecturerCodes.Count)
                return ApiResponse<CommitteeDetailDto>.Fail("Không được trùng lặp giảng viên trong hội đồng", StatusCodes.Status400BadRequest);

            await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);
            try
            {
                var committee = await _db.Committees.FirstOrDefaultAsync(c => c.CommitteeCode == request.CommitteeCode, cancellationToken);
                if (committee == null)
                    return ApiResponse<CommitteeDetailDto>.Fail("Không tìm thấy hội đồng", StatusCodes.Status404NotFound);

                var normalizedCodes = distinctCodes.Select(c => c.ToUpperInvariant()).ToList();
                var profiles = await _db.LecturerProfiles.Include(p => p.User)
                    .Where(p => p.LecturerCode != null && normalizedCodes.Contains(p.LecturerCode.ToUpper()))
                    .ToListAsync(cancellationToken);

                if (profiles.Count != distinctCodes.Count)
                    return ApiResponse<CommitteeDetailDto>.Fail("Một hoặc nhiều giảng viên không tồn tại", StatusCodes.Status400BadRequest);

                var profileMap = profiles.ToDictionary(p => p.LecturerCode, StringComparer.OrdinalIgnoreCase);
                var replacements = new List<(LecturerProfile Profile, string Role, bool IsChair)>();

                foreach (var member in incomingMembers)
                {
                    var code = member.LecturerCode.Trim();
                    if (!profileMap.TryGetValue(code, out var profile))
                    {
                        return ApiResponse<CommitteeDetailDto>.Fail($"Không tìm thấy giảng viên: {code}", StatusCodes.Status400BadRequest);
                    }

                    var role = member.Role?.Trim() ?? string.Empty;
                    if (string.IsNullOrWhiteSpace(role))
                    {
                        return ApiResponse<CommitteeDetailDto>.Fail("Vai trò của thành viên không được bỏ trống", StatusCodes.Status400BadRequest);
                    }

                    var isChair = string.Equals(role, "Chủ tịch", StringComparison.OrdinalIgnoreCase);
                    if (isChair && !IsEligibleChairDegree(profile.Degree))
                    {
                        return ApiResponse<CommitteeDetailDto>.Fail("Chủ tịch phải có học vị Tiến sĩ hoặc Phó giáo sư", StatusCodes.Status400BadRequest);
                    }

                    replacements.Add((profile, role, isChair));
                }

                // Server-side validation: prevent a lecturer from being member of more than one committee on the same day
                if (!committee.DefenseDate.HasValue)
                {
                    return ApiResponse<CommitteeDetailDto>.Fail("Vui lòng đặt ngày bảo vệ trước khi lưu thành viên", StatusCodes.Status400BadRequest);
                }

                var targetDate = committee.DefenseDate.Value.Date;
                var lecturerCodesList = replacements.Select(r => r.Profile.LecturerCode).Where(c => !string.IsNullOrWhiteSpace(c)).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
                if (lecturerCodesList.Count > 0)
                {
                    var conflicts = await (from cm in _db.CommitteeMembers.AsNoTracking()
                                           join c in _db.Committees.AsNoTracking() on cm.CommitteeCode equals c.CommitteeCode
                                           where cm.MemberLecturerCode != null
                                                 && lecturerCodesList.Contains(cm.MemberLecturerCode)
                                                 && cm.CommitteeCode != committee.CommitteeCode
                                                 && c.DefenseDate.HasValue && c.DefenseDate.Value.Date == targetDate
                                           select new { cm.MemberLecturerCode, c.CommitteeCode }).ToListAsync(cancellationToken);

                    if (conflicts.Count > 0)
                    {
                        var grouped = conflicts.GroupBy(x => x.MemberLecturerCode, StringComparer.OrdinalIgnoreCase)
                            .Select(g => new { Lecturer = g.Key, Committees = g.Select(v => v.CommitteeCode).Distinct().ToList() })
                            .ToList();

                        var msgParts = grouped.Select(g => $"Giảng viên {g.Lecturer} đã được phân vào hội đồng: {string.Join(',', g.Committees)} trong cùng ngày {targetDate:dd/MM/yyyy}");
                        return ApiResponse<CommitteeDetailDto>.Fail(string.Join("; ", msgParts), StatusCodes.Status409Conflict);
                    }
                }

                await ReplaceCommitteeMembersInternalAsync(committee, replacements, cancellationToken);
                committee.LastUpdated = DateTime.UtcNow;

                await _uow.SaveChangesAsync();
                await tx.CommitAsync(cancellationToken);

                var detail = await GetCommitteeDetailAsync(request.CommitteeCode, cancellationToken);
                detail.HttpStatusCode = StatusCodes.Status200OK;
                return detail;
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync(cancellationToken);
                _logger.LogError(ex, "update committee members failed");
                return ApiResponse<CommitteeDetailDto>.Fail("Không thể cập nhật thành viên hội đồng", StatusCodes.Status500InternalServerError);
            }
        }

        public async Task<ApiResponse<bool>> DeleteCommitteeAsync(string committeeCode, bool force, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(committeeCode))
                return ApiResponse<bool>.Fail("Mã hội đồng không hợp lệ", StatusCodes.Status400BadRequest);

            await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);
            try
            {
                var committee = await _db.Committees.FirstOrDefaultAsync(c => c.CommitteeCode == committeeCode, cancellationToken);
                if (committee == null)
                    return ApiResponse<bool>.Fail("Không tìm thấy hội đồng", StatusCodes.Status404NotFound);

                // Load related data
                var assignments = await _db.DefenseAssignments.Where(a => a.CommitteeCode == committeeCode).ToListAsync(cancellationToken);
                var members = await _db.CommitteeMembers.Where(m => m.CommitteeCode == committeeCode).ToListAsync(cancellationToken);

                // If not forced, only allow deletion when there are no assignments and no members
                if (!force)
                {
                    if (assignments.Count > 0 || members.Count > 0)
                    {
                        return ApiResponse<bool>.Fail("Hội đồng đang có phân công hoặc thành viên. Dùng force=true để xóa.", StatusCodes.Status409Conflict);
                    }

                    // Safe to remove committee and its tags
                    var tagsToRemove = await _db.CommitteeTags.Where(t => t.CommitteeCode == committeeCode || t.CommitteeID == committee.CommitteeID).ToListAsync(cancellationToken);
                    if (tagsToRemove.Count > 0) _db.CommitteeTags.RemoveRange(tagsToRemove);

                    _db.Committees.Remove(committee);
                    await _uow.SaveChangesAsync();
                    await tx.CommitAsync(cancellationToken);

                    var okRes = ApiResponse<bool>.SuccessResponse(true);
                    okRes.HttpStatusCode = StatusCodes.Status200OK;
                    return okRes;
                }

                // force == true: remove assignments, members, update topic statuses, then delete committee
                if (assignments.Count > 0)
                {
                    var topicCodes = assignments.Where(a => !string.IsNullOrWhiteSpace(a.TopicCode)).Select(a => a.TopicCode!).Distinct().ToList();
                    if (topicCodes.Count > 0)
                    {
                        var topics = await _db.Topics.Where(t => topicCodes.Contains(t.TopicCode)).ToListAsync(cancellationToken);
                        foreach (var t in topics)
                        {
                            var old = t.Status;
                            t.Status = "Đủ điều kiện bảo vệ";
                            t.LastUpdated = DateTime.UtcNow;
                        }
                    }

                    // Remove assignments first to avoid FK issues
                    _db.DefenseAssignments.RemoveRange(assignments);
                }

                if (members.Count > 0)
                {
                    _db.CommitteeMembers.RemoveRange(members);
                }

                var tags = await _db.CommitteeTags.Where(t => t.CommitteeCode == committeeCode || t.CommitteeID == committee.CommitteeID).ToListAsync(cancellationToken);
                if (tags.Count > 0) _db.CommitteeTags.RemoveRange(tags);

                _db.Committees.Remove(committee);
                await _uow.SaveChangesAsync();
                await tx.CommitAsync(cancellationToken);

                var res = ApiResponse<bool>.SuccessResponse(true);
                res.HttpStatusCode = StatusCodes.Status200OK;
                return res;
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync(cancellationToken);
                _logger.LogError(ex, "delete committee failed");
                return ApiResponse<bool>.Fail("Không thể xóa hội đồng", StatusCodes.Status500InternalServerError);
            }
        }

        // ============ QUERIES ============
        public async Task<ApiResponse<PagedResult<CommitteeSummaryDto>>> GetCommitteesAsync(int page, int pageSize, string? keyword, DateTime? date, string[]? tags, CancellationToken cancellationToken = default)
        {
            try
            {
                page = page < 1 ? 1 : page;
                pageSize = pageSize < 1 ? 10 : Math.Min(pageSize, 100);

                var q = _db.Committees.AsNoTracking();
                if (!string.IsNullOrWhiteSpace(keyword))
                {
                    var s = keyword.Trim();
                    q = q.Where(c => c.CommitteeCode.Contains(s) || (c.Name != null && c.Name.Contains(s)));
                }
                if (date.HasValue)
                {
                    var d = date.Value.Date;
                    q = q.Where(c => c.DefenseDate.HasValue && c.DefenseDate.Value.Date == d);
                }
                if (tags != null && tags.Length > 0)
                {
                    var tagSet = new HashSet<string>(tags, StringComparer.OrdinalIgnoreCase);
                    q = q.Where(c => _db.CommitteeTags.Any(ct => ct.CommitteeCode == c.CommitteeCode && tagSet.Contains(ct.TagCode)));
                }

                var total = await q.CountAsync(cancellationToken);
                var itemsSrc = await q.OrderByDescending(c => c.LastUpdated).ThenBy(c => c.CommitteeCode)
                    .Skip((page - 1) * pageSize).Take(pageSize)
                    .Select(c => new
                    {
                        c.CommitteeCode, c.Name, c.DefenseDate, c.Room, c.CreatedAt, c.LastUpdated, c.Status
                    }).ToListAsync(cancellationToken);

                var codes = itemsSrc.Select(x => x.CommitteeCode).ToList();
                var memberCounts = await _db.CommitteeMembers.AsNoTracking().Where(m => m.CommitteeCode != null && codes.Contains(m.CommitteeCode))
                    .GroupBy(m => m.CommitteeCode!).Select(g => new { g.Key, C = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.C, cancellationToken);
                var topicCounts = await _db.DefenseAssignments.AsNoTracking().Where(a => a.CommitteeCode != null && codes.Contains(a.CommitteeCode))
                    .GroupBy(a => a.CommitteeCode!).Select(g => new { g.Key, C = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.C, cancellationToken);
                var tagCodes = await _db.CommitteeTags.AsNoTracking().Where(t => codes.Contains(t.CommitteeCode))
                    .Join(_db.Tags.AsNoTracking(), ct => ct.TagID, tg => tg.TagID, (ct, tg) => new { ct.CommitteeCode, tg.TagCode })
                    .ToListAsync(cancellationToken);
                var tagMap = tagCodes.GroupBy(x => x.CommitteeCode).ToDictionary(g => g.Key, g => g.Select(v => v.TagCode).Distinct().ToList());

                var items = itemsSrc.Select(c => new CommitteeSummaryDto
                {
                    CommitteeCode = c.CommitteeCode,
                    Name = c.Name,
                    DefenseDate = c.DefenseDate,
                    Room = c.Room,
                    CreatedAt = c.CreatedAt,
                    LastUpdated = c.LastUpdated,
                    Status = c.Status,
                    MemberCount = memberCounts.TryGetValue(c.CommitteeCode, out var mc) ? mc : 0,
                    TopicCount = topicCounts.TryGetValue(c.CommitteeCode, out var tc) ? tc : 0,
                    TagCodes = tagMap.TryGetValue(c.CommitteeCode, out var lst) ? lst : new List<string>()
                }).ToList();

                var result = new PagedResult<CommitteeSummaryDto> { Items = items, TotalCount = total };
                var res = ApiResponse<PagedResult<CommitteeSummaryDto>>.SuccessResponse(result, total);
                res.HttpStatusCode = StatusCodes.Status200OK;
                return res;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "list committees failed");
                return ApiResponse<PagedResult<CommitteeSummaryDto>>.Fail("Không thể tải danh sách hội đồng", StatusCodes.Status500InternalServerError);
            }
        }

        public async Task<ApiResponse<CommitteeDetailDto>> GetCommitteeDetailAsync(string committeeCode, CancellationToken cancellationToken = default)
        {
            try
            {
                var committee = await _db.Committees.AsNoTracking()
                    .FirstOrDefaultAsync(x => x.CommitteeCode == committeeCode, cancellationToken);

                if (committee == null)
                {
                    return ApiResponse<CommitteeDetailDto>.Fail("Không tìm thấy hội đồng", StatusCodes.Status404NotFound);
                }

                var tags = await _db.CommitteeTags.AsNoTracking()
                    .Where(ct => ct.CommitteeCode == committeeCode)
                    .Join(_db.Tags.AsNoTracking(), ct => ct.TagID, t => t.TagID,
                        (ct, t) => new TagReadDto(t.TagID, t.TagCode, t.TagName, t.Description, t.CreatedAt))
                    .ToListAsync(cancellationToken);

                var memberRecords = await (from m in _db.CommitteeMembers.AsNoTracking()
                                            where m.CommitteeCode == committeeCode
                                            join lp in _db.LecturerProfiles.AsNoTracking() on m.MemberLecturerCode equals lp.LecturerCode
                                            join u in _db.Users.AsNoTracking() on lp.UserCode equals u.UserCode into userGroup
                                            from user in userGroup.DefaultIfEmpty()
                                            select new
                                            {
                                                LecturerProfileId = (m.MemberLecturerProfileID ?? 0) != 0 ? m.MemberLecturerProfileID!.Value : lp.LecturerProfileID,
                                                LecturerCode = lp.LecturerCode,
                                                FullName = lp.FullName ?? lp.LecturerCode,
                                                Role = m.Role ?? string.Empty,
                                                IsChair = m.IsChair ?? false,
                                                Degree = lp.Degree
                                            })
                    .OrderBy(x => x.IsChair ? 0 : 1)
                    .ThenBy(x => x.FullName)
                    .ToListAsync(cancellationToken);

                var memberProfileIds = memberRecords.Select(x => x.LecturerProfileId).Where(id => id > 0).Distinct().ToList();
                var memberTagMap = new Dictionary<int, (List<string> Codes, List<string> Names)>();

                if (memberProfileIds.Count > 0)
                {
                    var memberTagRows = await _db.LecturerTags.AsNoTracking()
                        .Where(lt => memberProfileIds.Contains(lt.LecturerProfileID))
                        .Join(_db.Tags.AsNoTracking(), lt => lt.TagID, t => t.TagID,
                            (lt, t) => new { lt.LecturerProfileID, lt.TagCode, t.TagName })
                        .ToListAsync(cancellationToken);

                    memberTagMap = memberTagRows
                        .GroupBy(x => x.LecturerProfileID)
                        .ToDictionary(
                            g => g.Key,
                            g =>
                            (
                                Codes: g.Select(v => string.IsNullOrWhiteSpace(v.TagCode) ? null : v.TagCode!.Trim())
                                    .Where(v => v != null)
                                    .Cast<string>()
                                    .Distinct(StringComparer.OrdinalIgnoreCase)
                                    .ToList(),
                                Names: g.Select(v => v.TagName)
                                    .Where(name => !string.IsNullOrWhiteSpace(name))
                                    .Distinct()
                                    .ToList()
                            ));
                }

                var members = memberRecords.Select(x =>
                {
                    if (!memberTagMap.TryGetValue(x.LecturerProfileId, out var tagInfo))
                    {
                        tagInfo = (new List<string>(), new List<string>());
                    }

                    return new CommitteeMemberSummaryDto
                    {
                        LecturerProfileId = x.LecturerProfileId,
                        LecturerCode = x.LecturerCode,
                        FullName = x.FullName,
                        Role = x.Role,
                        IsChair = x.IsChair,
                        Degree = x.Degree,
                        TagCodes = tagInfo.Codes,
                        TagNames = tagInfo.Names
                    };
                }).ToList();

                var assignmentRecords = await (from a in _db.DefenseAssignments.AsNoTracking()
                                                where a.CommitteeCode == committeeCode
                                                join t in _db.Topics.AsNoTracking() on a.TopicCode equals t.TopicCode
                                                join sp in _db.StudentProfiles.AsNoTracking() on t.ProposerStudentCode equals sp.StudentCode into studentGroup
                                                from proposer in studentGroup.DefaultIfEmpty()
                                                join lp in _db.LecturerProfiles.AsNoTracking() on t.SupervisorLecturerCode equals lp.LecturerCode into lecturerGroup
                                                from supervisor in lecturerGroup.DefaultIfEmpty()
                                                select new
                                                {
                                                    a.AssignmentCode,
                                                    a.Session,
                                                    a.StartTime,
                                                    a.EndTime,
                                                    a.ScheduledAt,
                                                    t.TopicCode,
                                                    t.Title,
                                                    t.ProposerStudentCode,
                                                    StudentName = proposer != null ? proposer.FullName : null,
                                                    SupervisorCode = t.SupervisorLecturerCode,
                                                    SupervisorName = supervisor != null ? supervisor.FullName : null
                                                })
                    .OrderBy(x => x.Session)
                    .ThenBy(x => x.StartTime)
                    .ToListAsync(cancellationToken);

                var assignmentStudentCodes = assignmentRecords
                    .Select(x => x.ProposerStudentCode)
                    .Where(code => !string.IsNullOrWhiteSpace(code))
                    .Cast<string>()
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();

                var studentNameMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                var studentUserFallback = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

                if (assignmentStudentCodes.Count > 0)
                {
                    var studentRows = await _db.StudentProfiles.AsNoTracking()
                        .Where(sp => assignmentStudentCodes.Contains(sp.StudentCode))
                        .Select(sp => new { sp.StudentCode, sp.FullName, sp.UserCode })
                        .ToListAsync(cancellationToken);

                    var fallbackUserCodes = studentRows
                        .Where(sp => string.IsNullOrWhiteSpace(sp.FullName) && !string.IsNullOrWhiteSpace(sp.UserCode))
                        .Select(sp => sp.UserCode!)
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .ToList();

                    // User no longer has FullName, skip fallback lookup
                    // if (fallbackUserCodes.Count > 0)
                    // {
                    //     var userRows = await _db.Users.AsNoTracking()
                    //         .Where(u => fallbackUserCodes.Contains(u.UserCode))
                    //         .Select(u => new { u.UserCode })
                    //         .ToListAsync(cancellationToken);
                    //     studentUserFallback = userRows.ToDictionary(x => x.UserCode, x => x.UserCode, StringComparer.OrdinalIgnoreCase);
                    // }

                    foreach (var row in studentRows)
                    {
                        var resolvedName = !string.IsNullOrWhiteSpace(row.FullName)
                            ? row.FullName!
                            : (!string.IsNullOrWhiteSpace(row.UserCode) && studentUserFallback.TryGetValue(row.UserCode!, out var name)
                                ? name
                                : row.StudentCode);

                        studentNameMap[row.StudentCode] = resolvedName;
                    }
                }

                var supervisorCodes = assignmentRecords
                    .Select(x => x.SupervisorCode)
                    .Where(code => !string.IsNullOrWhiteSpace(code))
                    .Cast<string>()
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();

                var supervisorNameMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                var supervisorUserFallback = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

                if (supervisorCodes.Count > 0)
                {
                    var supervisorRows = await _db.LecturerProfiles.AsNoTracking()
                        .Where(lp => supervisorCodes.Contains(lp.LecturerCode))
                        .Select(lp => new { lp.LecturerCode, lp.FullName, lp.UserCode })
                        .ToListAsync(cancellationToken);

                    var fallbackUserCodes = supervisorRows
                        .Where(lp => string.IsNullOrWhiteSpace(lp.FullName) && !string.IsNullOrWhiteSpace(lp.UserCode))
                        .Select(lp => lp.UserCode!)
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .ToList();

                    // User no longer has FullName, skip fallback lookup
                    // if (fallbackUserCodes.Count > 0)
                    // {
                    //     var userRows = await _db.Users.AsNoTracking()
                    //         .Where(u => fallbackUserCodes.Contains(u.UserCode))
                    //         .Select(u => new { u.UserCode })
                    //         .ToListAsync(cancellationToken);
                    //     supervisorUserFallback = userRows.ToDictionary(x => x.UserCode, x => x.UserCode, StringComparer.OrdinalIgnoreCase);
                    // }

                    foreach (var row in supervisorRows)
                    {
                        var resolvedName = !string.IsNullOrWhiteSpace(row.FullName)
                            ? row.FullName!
                            : (!string.IsNullOrWhiteSpace(row.UserCode) && supervisorUserFallback.TryGetValue(row.UserCode!, out var name)
                                ? name
                                : row.LecturerCode);

                        supervisorNameMap[row.LecturerCode] = resolvedName;
                    }
                }

                var assignments = assignmentRecords.Select(x => new CommitteeAssignmentItemDto
                {
                    AssignmentCode = x.AssignmentCode,
                    TopicCode = x.TopicCode,
                    Title = x.Title,
                    StudentCode = x.ProposerStudentCode,
                    StudentName = x.StudentName ?? (x.ProposerStudentCode != null && studentNameMap.TryGetValue(x.ProposerStudentCode, out var student)
                        ? student
                        : null),
                    SupervisorCode = x.SupervisorCode,
                    SupervisorName = x.SupervisorName ?? (x.SupervisorCode != null && supervisorNameMap.TryGetValue(x.SupervisorCode, out var supervisor)
                        ? supervisor
                        : null),
                    Session = x.Session,
                    StartTime = x.StartTime,
                    EndTime = x.EndTime,
                    ScheduledAt = x.ScheduledAt
                }).ToList();

                var sessions = assignments
                    .GroupBy(x => x.Session ?? 0)
                    .OrderBy(g => g.Key)
                    .Select(g => new CommitteeSessionDto
                    {
                        Session = g.Key,
                        Topics = g.OrderBy(x => x.StartTime ?? TimeSpan.Zero)
                            .Select(x => new CommitteeSessionTopicDto
                            {
                                AssignmentCode = x.AssignmentCode,
                                TopicCode = x.TopicCode,
                                Title = x.Title,
                                StudentCode = x.StudentCode,
                                StudentName = x.StudentName,
                                SupervisorCode = x.SupervisorCode,
                                SupervisorName = x.SupervisorName,
                                StartTime = FormatTimeSpan(x.StartTime),
                                EndTime = FormatTimeSpan(x.EndTime)
                            }).ToList()
                    }).ToList();

                var detail = new CommitteeDetailDto
                {
                    CommitteeCode = committee.CommitteeCode,
                    Name = committee.Name,
                    DefenseDate = committee.DefenseDate,
                    Room = committee.Room,
                    Status = committee.Status,
                    Tags = tags,
                    Members = members,
                    Assignments = assignments,
                    Sessions = sessions
                };

                var res = ApiResponse<CommitteeDetailDto>.SuccessResponse(detail);
                res.HttpStatusCode = StatusCodes.Status200OK;
                return res;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "get detail failed");
                return ApiResponse<CommitteeDetailDto>.Fail("Không thể tải chi tiết hội đồng", StatusCodes.Status500InternalServerError);
            }
        }

        // ============ Availability ============
        public async Task<ApiResponse<List<AvailableLecturerDto>>> GetAvailableLecturersAsync(string? tag, DateTime? date, string? role, bool? requireChair, string? committeeCode, CancellationToken cancellationToken = default)
        {
            try
            {
                var tagFilters = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                if (!string.IsNullOrWhiteSpace(tag))
                {
                    foreach (var value in SplitValues(tag))
                    {
                        tagFilters.Add(value);
                    }
                }

                if (!string.IsNullOrWhiteSpace(committeeCode))
                {
                    var committeeTags = await _db.CommitteeTags.AsNoTracking()
                        .Where(ct => ct.CommitteeCode == committeeCode)
                        .Select(ct => ct.TagCode)
                        .ToListAsync(cancellationToken);

                    foreach (var value in committeeTags.Where(v => !string.IsNullOrWhiteSpace(v)))
                    {
                        tagFilters.Add(value!.Trim());
                    }
                }

                IQueryable<LecturerProfile> lecturerQuery = _db.LecturerProfiles
                    .AsNoTracking()
                    .Include(lp => lp.User);

                // Load all lecturers first
                var allLecturers = await lecturerQuery.ToListAsync(cancellationToken);

                // If tag filters were provided (or committeeCode implied tags), filter in memory
                List<LecturerProfile> lecturers;
                if (tagFilters.Count > 0)
                {
                    var filterSet = tagFilters;
                    lecturers = allLecturers
                        .Where(lp =>
                        {
                            var specialtyCodes = new HashSet<string>(SplitValues(lp.Specialties), StringComparer.OrdinalIgnoreCase);
                            return specialtyCodes.Count > 0 && specialtyCodes.Any(code => filterSet.Contains(code));
                        })
                        .ToList();
                }
                else
                {
                    lecturers = allLecturers;
                }

                var lecturerCodes = lecturers.Select(l => l.LecturerCode).Where(code => !string.IsNullOrWhiteSpace(code)).ToList();

                var loadQuery = from cm in _db.CommitteeMembers.AsNoTracking()
                                join da in _db.DefenseAssignments.AsNoTracking() on cm.CommitteeCode equals da.CommitteeCode
                                where cm.MemberLecturerCode != null && lecturerCodes.Contains(cm.MemberLecturerCode)
                                select new { cm.MemberLecturerCode };

                var loadList = await loadQuery
                    .GroupBy(x => x.MemberLecturerCode!)
                    .Select(g => new { LecturerCode = g.Key, Count = g.Count() })
                    .ToListAsync(cancellationToken);

                var loadMap = loadList.ToDictionary(x => x.LecturerCode, x => x.Count, StringComparer.OrdinalIgnoreCase);

                var result = new List<AvailableLecturerDto>();
                foreach (var lecturer in lecturers)
                {
                    var lecturerCode = lecturer.LecturerCode ?? string.Empty;
                    var load = loadMap.TryGetValue(lecturerCode, out var count) ? count : 0;
                    var eligibleChair = IsEligibleChairDegree(lecturer.Degree);

            var tagCodes = (lecturer.LecturerTags?
                .Select(lt => string.IsNullOrWhiteSpace(lt.TagCode) ? lt.Tag?.TagCode : lt.TagCode)
                ?? Enumerable.Empty<string?>())
                        .Where(code => !string.IsNullOrWhiteSpace(code))
                        .Select(code => code!.Trim())
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .ToList();

            var tagNames = (lecturer.LecturerTags?
                .Select(lt => lt.Tag?.TagName)
                ?? Enumerable.Empty<string?>())
                        .Where(name => !string.IsNullOrWhiteSpace(name))
                        .Cast<string>()
                        .Distinct()
                        .ToList();

                    var fullName = !string.IsNullOrWhiteSpace(lecturer.FullName)
                        ? lecturer.FullName!
                        : lecturerCode;

                    var defenseQuota = lecturer.DefenseQuota ?? 0;
                    var availability = defenseQuota <= 0 || load < defenseQuota;

                    var dto = new AvailableLecturerDto
                    {
                        LecturerProfileId = lecturer.LecturerProfileID,
                        LecturerCode = lecturerCode,
                        FullName = lecturer.FullName ?? lecturerCode,
                        DepartmentCode = lecturer.DepartmentCode,
                        Degree = lecturer.Degree,
                        IsEligibleChair = eligibleChair,
                        DefenseQuota = defenseQuota,
                        CurrentDefenseLoad = load,
                        Availability = availability,
                        TagCodes = tagCodes,
                        TagNames = tagNames
                    };

                    result.Add(dto);
                }

                if (!string.IsNullOrWhiteSpace(role))
                {
                    var normalizedRole = role.Trim();
                    if (string.Equals(normalizedRole, "Chủ tịch", StringComparison.OrdinalIgnoreCase))
                    {
                        result = result.Where(r => r.IsEligibleChair).ToList();
                    }
                }

                if (requireChair.GetValueOrDefault(false))
                {
                    result = result.Where(r => r.IsEligibleChair).ToList();
                }

                result = result.OrderBy(r => r.FullName).ToList();

                var res = ApiResponse<List<AvailableLecturerDto>>.SuccessResponse(result);
                res.HttpStatusCode = StatusCodes.Status200OK;
                return res;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "available lecturers failed");
                return ApiResponse<List<AvailableLecturerDto>>.Fail("Không thể tải giảng viên", StatusCodes.Status500InternalServerError);
            }
        }

        public async Task<ApiResponse<List<AvailableTopicDto>>> GetAvailableTopicsAsync(string? tag, string? department, string? committeeCode, CancellationToken cancellationToken = default)
        {
            try
            {
                var tagFilters = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                if (!string.IsNullOrWhiteSpace(tag))
                {
                    foreach (var value in SplitValues(tag))
                    {
                        tagFilters.Add(value);
                    }
                }

                if (!string.IsNullOrWhiteSpace(committeeCode))
                {
                    var committeeTags = await _db.CommitteeTags.AsNoTracking()
                        .Where(ct => ct.CommitteeCode == committeeCode)
                        .Select(ct => ct.TagCode)
                        .ToListAsync(cancellationToken);

                    foreach (var value in committeeTags.Where(v => !string.IsNullOrWhiteSpace(v)))
                    {
                        tagFilters.Add(value!.Trim());
                    }
                }

                // Only topics that are eligible and not currently assigned to any committee
                var q = _db.Topics.AsNoTracking().Where(t => t.Status == "Đủ điều kiện bảo vệ");
                if (!string.IsNullOrWhiteSpace(department))
                {
                    q = q.Where(t => t.DepartmentCode == department);
                }

                // Exclude topics that already have defense assignments (defensive safety)
                q = q.Where(t => !_db.DefenseAssignments.Any(a => a.TopicCode == t.TopicCode));

                // Fetch base topic info with proposer and supervisor names
                var topics = await q
                    .GroupJoin(_db.StudentProfiles.AsNoTracking(), t => t.ProposerStudentCode, sp => sp.StudentCode, (t, sp) => new { t, proposer = sp.FirstOrDefault() })
                    .SelectMany(tmp => _db.LecturerProfiles.AsNoTracking().Where(lp => lp.LecturerCode == tmp.t.SupervisorLecturerCode).DefaultIfEmpty(), (tmp, sup) => new { tmp.t, tmp.proposer, supervisor = sup })
                    .Select(x => new AvailableTopicDto
                    {
                        TopicCode = x.t.TopicCode,
                        Title = x.t.Title,
                        StudentCode = x.t.ProposerStudentCode,
                        StudentName = x.proposer != null ? x.proposer.FullName : null,
                        SupervisorCode = x.t.SupervisorLecturerCode,
                        SupervisorName = x.supervisor != null ? x.supervisor.FullName : null,
                        DepartmentCode = x.t.DepartmentCode,
                        Tags = new List<string>(),
                        TagDescriptions = new List<string>()
                    })
                    .OrderBy(t => t.Title)
                    .ToListAsync(cancellationToken);

                var topicStudentCodes = topics
                    .Select(x => x.StudentCode)
                    .Where(code => !string.IsNullOrWhiteSpace(code))
                    .Cast<string>()
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();

                var topicStudentNameMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                var topicStudentFallback = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

                if (topicStudentCodes.Count > 0)
                {
                    var studentRows = await _db.StudentProfiles.AsNoTracking()
                        .Where(sp => topicStudentCodes.Contains(sp.StudentCode))
                        .Select(sp => new { sp.StudentCode, sp.FullName, sp.UserCode })
                        .ToListAsync(cancellationToken);

                    var fallbackCodes = studentRows
                        .Where(sp => string.IsNullOrWhiteSpace(sp.FullName) && !string.IsNullOrWhiteSpace(sp.UserCode))
                        .Select(sp => sp.UserCode!)
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .ToList();

                    // User no longer has FullName, skip fallback lookup
                    // if (fallbackCodes.Count > 0)
                    // {
                    //     var userRows = await _db.Users.AsNoTracking()
                    //         .Where(u => fallbackCodes.Contains(u.UserCode))
                    //         .Select(u => new { u.UserCode })
                    //         .ToListAsync(cancellationToken);
                    //     topicStudentFallback = userRows.ToDictionary(x => x.UserCode, x => x.UserCode, StringComparer.OrdinalIgnoreCase);
                    // }

                    foreach (var row in studentRows)
                    {
                        var resolvedName = !string.IsNullOrWhiteSpace(row.FullName)
                            ? row.FullName!
                            : (!string.IsNullOrWhiteSpace(row.UserCode) && topicStudentFallback.TryGetValue(row.UserCode!, out var name)
                                ? name
                                : row.StudentCode);

                        topicStudentNameMap[row.StudentCode] = resolvedName;
                    }
                }

                var topicSupervisorCodes = topics
                    .Select(x => x.SupervisorCode)
                    .Where(code => !string.IsNullOrWhiteSpace(code))
                    .Cast<string>()
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();

                var topicSupervisorNameMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                var topicSupervisorFallback = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

                if (topicSupervisorCodes.Count > 0)
                {
                    var supervisorRows = await _db.LecturerProfiles.AsNoTracking()
                        .Where(lp => topicSupervisorCodes.Contains(lp.LecturerCode))
                        .Select(lp => new { lp.LecturerCode, lp.FullName, lp.UserCode })
                        .ToListAsync(cancellationToken);

                    var fallbackCodes = supervisorRows
                        .Where(lp => string.IsNullOrWhiteSpace(lp.FullName) && !string.IsNullOrWhiteSpace(lp.UserCode))
                        .Select(lp => lp.UserCode!)
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .ToList();

                    // User no longer has FullName, skip fallback lookup
                    // if (fallbackCodes.Count > 0)
                    // {
                    //     var userRows = await _db.Users.AsNoTracking()
                    //         .Where(u => fallbackCodes.Contains(u.UserCode))
                    //         .Select(u => new { u.UserCode })
                    //         .ToListAsync(cancellationToken);
                    //     topicSupervisorFallback = userRows.ToDictionary(x => x.UserCode, x => x.UserCode, StringComparer.OrdinalIgnoreCase);
                    // }

                    foreach (var row in supervisorRows)
                    {
                        var resolvedName = !string.IsNullOrWhiteSpace(row.FullName)
                            ? row.FullName!
                            : (!string.IsNullOrWhiteSpace(row.UserCode) && topicSupervisorFallback.TryGetValue(row.UserCode!, out var name)
                                ? name
                                : row.LecturerCode);

                        topicSupervisorNameMap[row.LecturerCode] = resolvedName;
                    }
                }

                // Update topics with resolved names from maps
                foreach (var topic in topics)
                {
                    if (!string.IsNullOrWhiteSpace(topic.StudentCode) && topicStudentNameMap.TryGetValue(topic.StudentCode, out var studentName))
                    {
                        topic.StudentName = studentName;
                    }
                    if (!string.IsNullOrWhiteSpace(topic.SupervisorCode) && topicSupervisorNameMap.TryGetValue(topic.SupervisorCode, out var supervisorName))
                    {
                        topic.SupervisorName = supervisorName;
                    }
                }

                // Populate tag names for the returned topics
                var topicCodes = topics.Select(t => t.TopicCode).ToList();
                if (topicCodes.Count > 0)
                {
                    var tagMap = await _db.TopicTags.AsNoTracking()
                        .Where(tt => tt.TopicCode != null && topicCodes.Contains(tt.TopicCode))
                        .Join(_db.Tags.AsNoTracking(), tt => tt.TagID, tg => tg.TagID, (tt, tg) => new { tt.TopicCode, tg.TagName, tg.TagCode })
                        .ToListAsync(cancellationToken);

                    var grouped = tagMap.GroupBy(x => x.TopicCode).ToDictionary(
                        g => g.Key!,
                        g => new
                        {
                            Codes = g.Select(v => v.TagCode!).Where(codeValue => !string.IsNullOrWhiteSpace(codeValue)).Distinct(StringComparer.OrdinalIgnoreCase).ToList(),
                            Names = g.Select(v => v.TagName!).Where(nameValue => !string.IsNullOrWhiteSpace(nameValue)).Distinct().ToList()
                        });
                    foreach (var topic in topics)
                    {
                        if (grouped.TryGetValue(topic.TopicCode, out var info))
                        {
                            topic.Tags = info.Codes;
                            topic.TagDescriptions = info.Names;
                        }
                    }
                }

                if (tagFilters.Count > 0)
                {
                    topics = topics
                        .Where(t => t.Tags.Any(code => tagFilters.Contains(code)))
                        .ToList();
                }

                return ApiResponse<List<AvailableTopicDto>>.SuccessResponse(topics);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "available topics failed");
                return ApiResponse<List<AvailableTopicDto>>.Fail("Không thể tải đề tài", StatusCodes.Status500InternalServerError);
            }
        }

        // Tags
        public async Task<ApiResponse<List<ThesisManagement.Api.DTOs.TagReadDto>>> GetTagsAsync(CancellationToken cancellationToken = default)
        {
            try
            {
                var tags = await _db.Tags.AsNoTracking()
                    .OrderBy(t => t.TagName)
                    .Select(t => new ThesisManagement.Api.DTOs.TagReadDto(
                        t.TagID,
                        t.TagCode,
                        t.TagName,
                        t.Description,
                        t.CreatedAt
                    ))
                    .ToListAsync(cancellationToken);

                var res = ApiResponse<List<ThesisManagement.Api.DTOs.TagReadDto>>.SuccessResponse(tags);
                res.HttpStatusCode = StatusCodes.Status200OK;
                return res;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "get tags failed");
                return ApiResponse<List<ThesisManagement.Api.DTOs.TagReadDto>>.Fail("Không thể lấy danh sách tag", StatusCodes.Status500InternalServerError);
            }
        }

        // ============ Assignments ============
        public async Task<ApiResponse<CommitteeDetailDto>> AssignTopicsAsync(AssignTopicRequestDto request, CancellationToken cancellationToken = default)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.CommitteeCode))
            {
                return ApiResponse<CommitteeDetailDto>.Fail("Dữ liệu phân công không hợp lệ", StatusCodes.Status400BadRequest);
            }

            var incomingItems = (request.Items ?? new List<AssignTopicItemDto>())
                .Where(i => !string.IsNullOrWhiteSpace(i.TopicCode))
                .ToList();

            if (incomingItems.Count == 0)
            {
                return ApiResponse<CommitteeDetailDto>.Fail("Chưa chọn đề tài", StatusCodes.Status400BadRequest);
            }

            await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);
            try
            {
                var committee = await _db.Committees.FirstOrDefaultAsync(c => c.CommitteeCode == request.CommitteeCode, cancellationToken);
                if (committee == null)
                {
                    return ApiResponse<CommitteeDetailDto>.Fail("Không tìm thấy hội đồng", StatusCodes.Status404NotFound);
                }

                var resolved = new List<(AssignTopicItemDto Item, DateTime Date, int Session, TimeSpan Start, TimeSpan End)>();
                var missingDate = false;

                foreach (var item in incomingItems)
                {
                    var session = item.Session ?? request.Session ?? 1;
                    if (session < 1)
                    {
                        session = 1;
                    }

                    var scheduledAt = item.ScheduledAt ?? request.ScheduledAt ?? committee.DefenseDate;
                    if (!scheduledAt.HasValue)
                    {
                        missingDate = true;
                        break;
                    }

                    var slot = ResolveSlot(item.StartTime, item.EndTime, session);
                    resolved.Add((item, scheduledAt.Value.Date, session, slot.Start, slot.End));
                }

                if (missingDate)
                {
                    return ApiResponse<CommitteeDetailDto>.Fail("Vui lòng chọn ngày bảo vệ trước khi gán đề tài", StatusCodes.Status400BadRequest);
                }

                var resolvedDates = resolved.Select(x => x.Date).Distinct().ToList();
                var existingAssignments = await _db.DefenseAssignments.AsNoTracking()
                    .Where(a => a.CommitteeCode == request.CommitteeCode && a.ScheduledAt.HasValue && resolvedDates.Contains(a.ScheduledAt.Value.Date))
                    .ToListAsync(cancellationToken);

                var existingMap = existingAssignments
                    .GroupBy(a => (a.ScheduledAt!.Value.Date, a.Session ?? 0))
                    .ToDictionary(g => g.Key, g => g.ToList());

                var pending = new Dictionary<(DateTime Date, int Session), List<(TimeSpan Start, TimeSpan End)>>();

                foreach (var entry in resolved)
                {
                    var key = (entry.Date, entry.Session);
                    if (!existingMap.TryGetValue(key, out var existingList))
                    {
                        existingList = new List<DefenseAssignment>();
                        existingMap[key] = existingList;
                    }

                    if (existingList.Count >= 4)
                    {
                        return ApiResponse<CommitteeDetailDto>.Fail("Mỗi buổi tối đa 4 đề tài", StatusCodes.Status400BadRequest);
                    }

                    foreach (var existing in existingList)
                    {
                        var existingStart = existing.StartTime ?? TimeSpan.Zero;
                        var existingEnd = existing.EndTime ?? TimeSpan.Zero;
                        if (existingStart == TimeSpan.Zero && existingEnd == TimeSpan.Zero)
                        {
                            return ApiResponse<CommitteeDetailDto>.Fail("Đề tài khác trong phiên chưa có khung giờ cố định, vui lòng cập nhật trước khi gán thêm.", StatusCodes.Status400BadRequest);
                        }

                        if (IsOverlap(existingStart, existingEnd, entry.Start, entry.End))
                        {
                            return ApiResponse<CommitteeDetailDto>.Fail($"Khung giờ bị trùng trong phiên {entry.Session}", StatusCodes.Status400BadRequest);
                        }
                    }

                    if (!pending.TryGetValue(key, out var pendingList))
                    {
                        pendingList = new List<(TimeSpan Start, TimeSpan End)>();
                        pending[key] = pendingList;
                    }

                    if (pendingList.Count + existingList.Count >= 4)
                    {
                        return ApiResponse<CommitteeDetailDto>.Fail("Mỗi buổi tối đa 4 đề tài", StatusCodes.Status400BadRequest);
                    }

                    if (pendingList.Any(r => IsOverlap(r.Start, r.End, entry.Start, entry.End)))
                    {
                        return ApiResponse<CommitteeDetailDto>.Fail($"Khung giờ bị trùng trong phiên {entry.Session}", StatusCodes.Status400BadRequest);
                    }

                    pendingList.Add((entry.Start, entry.End));
                }

                var now = DateTime.UtcNow;
                foreach (var entry in resolved)
                {
                    var topic = await _db.Topics.FirstOrDefaultAsync(t => t.TopicCode == entry.Item.TopicCode, cancellationToken);
                    if (topic == null)
                    {
                        throw new InvalidOperationException($"Topic not found: {entry.Item.TopicCode}");
                    }

                    if (!string.Equals(topic.Status, "Đủ điều kiện bảo vệ", StringComparison.OrdinalIgnoreCase))
                    {
                        throw new InvalidOperationException($"Đề tài {entry.Item.TopicCode} không đủ điều kiện để phân hội đồng.");
                    }

                    await _uow.DefenseAssignments.AddAsync(new DefenseAssignment
                    {
                        AssignmentCode = $"DA_{committee.CommitteeCode}_{topic.TopicCode}_{DateTime.UtcNow:yyyyMMddHHmmssfff}",
                        CommitteeCode = committee.CommitteeCode,
                        CommitteeID = committee.CommitteeID,
                        TopicCode = topic.TopicCode,
                        TopicID = topic.TopicID,
                        Session = entry.Session,
                        ScheduledAt = entry.Date,
                        StartTime = entry.Start,
                        EndTime = entry.End,
                        AssignedBy = string.IsNullOrWhiteSpace(request.AssignedBy) ? "system" : request.AssignedBy,
                        AssignedAt = now,
                        CreatedAt = now,
                        LastUpdated = now
                    });

                    topic.Status = "Đã phân hội đồng";
                    topic.LastUpdated = now;
                }

                await _uow.SaveChangesAsync();
                // RefreshCommitteeSessionsAsync removed from this path — CommitteeSessions is deprecated.
                // No DB writes required here; DefenseAssignments are the source of truth.
                await tx.CommitAsync(cancellationToken);
                return await GetCommitteeDetailAsync(committee.CommitteeCode, cancellationToken);
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync(cancellationToken);
                _logger.LogError(ex, "assign failed");
                return ApiResponse<CommitteeDetailDto>.Fail("Không thể phân công đề tài", StatusCodes.Status500InternalServerError);
            }
        }

        public async Task<ApiResponse<object>> AutoAssignTopicsAsync(AutoAssignRequestDto request, CancellationToken cancellationToken = default)
        {
            await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);
            try
            {
                var date = (request.Date ?? DateTime.UtcNow.Date).Date;
                var perLimit = request.PerSessionLimit.GetValueOrDefault(4);
                if (perLimit < 1) perLimit = 4;

                // Load committees and their tags
                var committees = await _db.Committees.AsNoTracking().Select(c => new { c.CommitteeID, c.CommitteeCode, c.Name, c.Room }).ToListAsync(cancellationToken);
                var codes = committees.Select(c => c.CommitteeCode).ToList();
                var tagMap = await _db.CommitteeTags.AsNoTracking()
                    .Where(ct => codes.Contains(ct.CommitteeCode))
                    .Join(_db.Tags.AsNoTracking(), ct => ct.TagID, t => t.TagID, (ct, t) => new { ct.CommitteeCode, t.TagCode })
                    .GroupBy(x => x.CommitteeCode)
                    .ToDictionaryAsync(g => g.Key, g => g.Select(v => v.TagCode).Distinct(StringComparer.OrdinalIgnoreCase).ToHashSet(StringComparer.OrdinalIgnoreCase), cancellationToken);

                // Eligible topics not yet assigned
                var eligibleTopics = await _db.Topics.AsNoTracking()
                    .Where(t => t.Status == "Đủ điều kiện bảo vệ")
                    .Select(t => new { t.TopicCode, t.Title })
                    .ToListAsync(cancellationToken);

                // Topic tags
                var topicCodes = eligibleTopics.Select(t => t.TopicCode).ToList();
                var topicTags = await _db.TopicTags.AsNoTracking()
                    .Where(tt => tt.TopicCode != null && topicCodes.Contains(tt.TopicCode))
                    .Join(_db.Tags.AsNoTracking(), tt => tt.TagID, tg => tg.TagID, (tt, tg) => new { tt.TopicCode, tg.TagCode })
                    .GroupBy(x => x.TopicCode!)
                    .ToDictionaryAsync(g => g.Key, g => g.Select(v => v.TagCode!).Distinct(StringComparer.OrdinalIgnoreCase).ToList(), cancellationToken);

                // Current assignments on the date
                var existing = await _db.DefenseAssignments.AsNoTracking()
                    .Where(a => a.ScheduledAt.HasValue && a.ScheduledAt.Value.Date == date)
                    .ToListAsync(cancellationToken);
                var counts = existing
                    .GroupBy(a => new { a.CommitteeCode, a.Session })
                    .ToDictionary(g => (g.Key.CommitteeCode!, g.Key.Session ?? 0), g => g.Count());

                int assignedCount = 0;
                var skipped = new List<object>();
                var touchedCommittees = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

                static IEnumerable<(int Session, TimeSpan Start, TimeSpan End)> DefaultSlots()
                {
                    // Four 60-minute slots per session: morning 07:30-11:30 and afternoon 13:30-17:30
                    var morning = new[] { new TimeSpan(7,30,0), new TimeSpan(8,30,0), new TimeSpan(9,30,0), new TimeSpan(10,30,0) };
                    var afternoon = new[] { new TimeSpan(13,30,0), new TimeSpan(14,30,0), new TimeSpan(15,30,0), new TimeSpan(16,30,0) };
                    foreach (var s in morning) yield return (1, s, s.Add(TimeSpan.FromMinutes(60)));
                    foreach (var s in afternoon) yield return (2, s, s.Add(TimeSpan.FromMinutes(60)));
                }

                bool HasOverlap(string committeeCode, int session, DateTime dateLocal, TimeSpan start, TimeSpan end)
                {
                    var day = dateLocal.Date;
                    var overlaps = existing.Where(a => a.CommitteeCode == committeeCode && (a.Session ?? 0) == session && a.ScheduledAt.HasValue && a.ScheduledAt.Value.Date == day);
                    foreach (var a in overlaps)
                    {
                        var s = a.StartTime ?? TimeSpan.Zero;
                        var e = a.EndTime ?? TimeSpan.Zero;
                        if (start < e && end > s) return true;
                    }
                    return false;
                }

                IEnumerable<(string TopicCode, List<string> Tags)> OrderedTopics()
                {
                    var list = eligibleTopics
                        .Select(t => (TopicCode: t.TopicCode, Tags: (topicTags.TryGetValue(t.TopicCode, out var tg) ? tg : new List<string>())))
                        .ToList();
                    if (request.TagPriorities != null && request.TagPriorities.Count > 0)
                    {
                        var prio = new HashSet<string>(request.TagPriorities, StringComparer.OrdinalIgnoreCase);
                        return list.OrderByDescending(x => x.Tags.Any(tag => prio.Contains(tag))).ThenBy(x => x.TopicCode);
                    }
                    return list.OrderBy(x => x.TopicCode);
                }

                foreach (var (topicCode, tags) in OrderedTopics())
                {
                    var best = committees
                        .Select(c => new
                        {
                            c.CommitteeCode,
                            Capacity1 = counts.TryGetValue((c.CommitteeCode, 1), out var c1) ? perLimit - c1 : perLimit,
                            Capacity2 = counts.TryGetValue((c.CommitteeCode, 2), out var c2) ? perLimit - c2 : perLimit,
                            MatchScore = tags.Count > 0 && tagMap.TryGetValue(c.CommitteeCode, out var ct) ? tags.Count(tag => ct.Contains(tag)) : 0,
                            Room = c.Room
                        })
                        .OrderByDescending(x => x.MatchScore)
                        .ThenByDescending(x => Math.Max(x.Capacity1, x.Capacity2))
                        .FirstOrDefault();

                    if (best == null || (best.Capacity1 <= 0 && best.Capacity2 <= 0))
                    {
                        skipped.Add(new { topicCode, reason = "Không còn hội đồng trống trong ngày" });
                        continue;
                    }

                    var placed = false;
                    foreach (var (session, start, end) in DefaultSlots())
                    {
                        var cap = session == 1 ? best.Capacity1 : best.Capacity2;
                        if (cap <= 0) continue;
                        if (HasOverlap(best.CommitteeCode, session, date, start, end)) continue;

                        var now = DateTime.UtcNow;
                        await _uow.DefenseAssignments.AddAsync(new DefenseAssignment
                        {
                            AssignmentCode = $"DA_{best.CommitteeCode}_{topicCode}_{DateTime.UtcNow:yyyyMMddHHmmssfff}",
                            CommitteeCode = best.CommitteeCode,
                            TopicCode = topicCode,
                            Session = session,
                            ScheduledAt = date,
                            StartTime = start,
                            EndTime = end,
                            AssignedAt = now,
                            CreatedAt = now,
                            LastUpdated = now
                        });

                        var topic = await _db.Topics.FirstAsync(t => t.TopicCode == topicCode, cancellationToken);
                        topic.Status = "Đã phân hội đồng";
                        topic.LastUpdated = now;

                        existing.Add(new DefenseAssignment { CommitteeCode = best.CommitteeCode, Session = session, ScheduledAt = date, StartTime = start, EndTime = end });
                        var key = (best.CommitteeCode, session);
                        counts[key] = counts.TryGetValue(key, out var current) ? current + 1 : 1;
                        assignedCount++;
                        touchedCommittees.Add(best.CommitteeCode);
                        placed = true;
                        break;
                    }

                    if (!placed)
                    {
                        skipped.Add(new { topicCode, reason = "Không tìm được khung giờ phù hợp (trùng lịch)" });
                    }
                }

                await _uow.SaveChangesAsync();
                if (touchedCommittees.Count > 0)
                {
                    // Previously refreshed CommitteeSessions for touched committees. CommitteeSessions is deprecated.
                    _logger.LogInformation("Auto-assign touched committees: {codes}", string.Join(',', touchedCommittees));
                }
                await tx.CommitAsync(cancellationToken);
                var payload = new { assignedCount, skipped };
                var res = ApiResponse<object>.SuccessResponse(payload);
                res.Message = "Tự động phân công hoàn tất";
                res.HttpStatusCode = StatusCodes.Status200OK;
                return res;
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync(cancellationToken);
                _logger.LogError(ex, "auto-assign failed");
                return ApiResponse<object>.Fail("Không thể tự động phân công đề tài", StatusCodes.Status500InternalServerError);
            }
        }

        public async Task<ApiResponse<CommitteeDetailDto>> ChangeAssignmentAsync(ChangeAssignmentRequestDto request, CancellationToken cancellationToken = default)
        {
            try
            {
                var assignment = await _db.DefenseAssignments.FirstOrDefaultAsync(a => a.CommitteeCode == request.CommitteeCode && a.TopicCode == request.TopicCode, cancellationToken);
                if (assignment == null) return ApiResponse<CommitteeDetailDto>.Fail("Không tìm thấy phân công", StatusCodes.Status404NotFound);

                // Parse incoming StartTime/EndTime strings into TimeSpan with sensible defaults
                var day = request.ScheduledAt.Date;
                var start = TimeSpan.TryParse(request.StartTime, out var parsedStart) ? parsedStart : new TimeSpan(7, 30, 0);
                var end = TimeSpan.TryParse(request.EndTime, out var parsedEnd) ? parsedEnd : new TimeSpan(11, 30, 0);

                // Overlap validation within same committee/date/session excluding this assignment
                var overlaps = await _db.DefenseAssignments.AsNoTracking()
                    .Where(a => a.CommitteeCode == request.CommitteeCode && (a.Session ?? 0) == request.Session && a.ScheduledAt.HasValue && a.ScheduledAt.Value.Date == day && a.TopicCode != request.TopicCode)
                    .ToListAsync(cancellationToken);
                foreach (var a in overlaps)
                {
                    var s = a.StartTime ?? TimeSpan.Zero;
                    var e = a.EndTime ?? TimeSpan.Zero;
                    if (start < e && end > s)
                    {
                        return ApiResponse<CommitteeDetailDto>.Fail("Khung giờ bị trùng với đề tài khác trong cùng phiên", StatusCodes.Status400BadRequest);
                    }
                }

                // Enforce cap 4 per session (excluding current)
                var countInSession = await _db.DefenseAssignments.AsNoTracking()
                    .CountAsync(a => a.CommitteeCode == request.CommitteeCode && (a.Session ?? 0) == request.Session && a.ScheduledAt.HasValue && a.ScheduledAt.Value.Date == day && a.TopicCode != request.TopicCode, cancellationToken);
                if (countInSession >= 4)
                {
                    return ApiResponse<CommitteeDetailDto>.Fail("Mỗi buổi tối đa 4 đề tài", StatusCodes.Status400BadRequest);
                }

                assignment.Session = request.Session;
                assignment.ScheduledAt = request.ScheduledAt;
                assignment.StartTime = start;
                assignment.EndTime = end;
                assignment.LastUpdated = DateTime.UtcNow;
                await _uow.SaveChangesAsync();
                var committee = await _db.Committees.FirstOrDefaultAsync(c => c.CommitteeCode == request.CommitteeCode, cancellationToken);
                if (committee != null)
                {
                    // CommitteeSessions deprecated; no synchronization required.
                    _logger.LogInformation("ChangeAssignment: updated DefenseAssignment for committee {code}", committee.CommitteeCode);
                }
                return await GetCommitteeDetailAsync(request.CommitteeCode, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "change assignment failed");
                return ApiResponse<CommitteeDetailDto>.Fail("Không thể thay đổi lịch", StatusCodes.Status500InternalServerError);
            }
        }

        public async Task<ApiResponse<CommitteeDetailDto>> RemoveAssignmentAsync(string topicCode, CancellationToken cancellationToken = default)
        {
            try
            {
                var assignment = await _db.DefenseAssignments.FirstOrDefaultAsync(a => a.TopicCode == topicCode, cancellationToken);
                if (assignment == null) return ApiResponse<CommitteeDetailDto>.Fail("Không tìm thấy phân công", StatusCodes.Status404NotFound);

                var committeeCode = assignment.CommitteeCode ?? string.Empty;
                _db.DefenseAssignments.Remove(assignment);
                var topic = await _db.Topics.FirstOrDefaultAsync(t => t.TopicCode == topicCode, cancellationToken);
                if (topic != null)
                {
                    topic.Status = "Đủ điều kiện bảo vệ";
                    topic.LastUpdated = DateTime.UtcNow;
                }
                await _uow.SaveChangesAsync();
                if (!string.IsNullOrWhiteSpace(committeeCode))
                {
                    // CommitteeSessions deprecated; DefenseAssignments are the source of truth.
                    _logger.LogInformation("RemoveAssignment: removed DefenseAssignment for committee {code}", committeeCode);
                }
                return await GetCommitteeDetailAsync(committeeCode, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "remove assignment failed");
                return ApiResponse<CommitteeDetailDto>.Fail("Không thể gỡ phân công", StatusCodes.Status500InternalServerError);
            }
        }

        // ============ Views ============
        public async Task<ApiResponse<LecturerCommitteesDto>> GetLecturerCommitteesAsync(string lecturerCode, CancellationToken cancellationToken = default)
        {
            try
            {
                var committees = await _db.CommitteeMembers.AsNoTracking().Where(m => m.MemberLecturerCode == lecturerCode && m.CommitteeCode != null)
                    .Join(_db.Committees.AsNoTracking(), m => m.CommitteeCode, c => c.CommitteeCode, (m, c) => c.CommitteeCode)
                    .Distinct().ToListAsync(cancellationToken);

                var items = new List<CommitteeDetailDto>();
                foreach (var code in committees)
                {
                    var detail = await GetCommitteeDetailAsync(code, cancellationToken);
                    if (detail.Success && detail.Data != null) items.Add(detail.Data);
                }

                var res = ApiResponse<LecturerCommitteesDto>.SuccessResponse(new LecturerCommitteesDto
                {
                    LecturerCode = lecturerCode,
                    Committees = items
                });
                res.HttpStatusCode = StatusCodes.Status200OK;
                return res;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "lecturer committees failed");
                return ApiResponse<LecturerCommitteesDto>.Fail("Không thể tải dữ liệu giảng viên", StatusCodes.Status500InternalServerError);
            }
        }

        public async Task<ApiResponse<StudentDefenseInfoDto>> GetStudentDefenseInfoAsync(string studentCode, CancellationToken cancellationToken = default)
        {
            try
            {
                var topic = await _db.Topics.AsNoTracking().Where(t => t.ProposerStudentCode == studentCode).OrderByDescending(t => t.LastUpdated).FirstOrDefaultAsync(cancellationToken);
                if (topic == null) return ApiResponse<StudentDefenseInfoDto>.Fail("Không tìm thấy đề tài", StatusCodes.Status404NotFound);
                var assignment = await _db.DefenseAssignments.AsNoTracking().Where(a => a.TopicCode == topic.TopicCode).FirstOrDefaultAsync(cancellationToken);
                var committee = assignment != null && assignment.CommitteeCode != null
                    ? await _db.Committees.AsNoTracking().FirstOrDefaultAsync(c => c.CommitteeCode == assignment.CommitteeCode, cancellationToken)
                    : null;

                var members = new List<StudentCommitteeMemberDto>();
                if (committee != null)
                {
                    members = await _db.CommitteeMembers.AsNoTracking().Where(m => m.CommitteeCode == committee.CommitteeCode)
                        .Join(_db.LecturerProfiles.AsNoTracking(), m => m.MemberLecturerCode, p => p.LecturerCode, (m, p) => new { m, p })
                        .Select(mp => new StudentCommitteeMemberDto
                        {
                            Name = mp.p.FullName ?? mp.p.LecturerCode,
                            Role = mp.m.Role ?? string.Empty
                        }).ToListAsync(cancellationToken);
                }

                var payload = new StudentDefenseInfoDto
                {
                    StudentCode = studentCode,
                    TopicCode = topic.TopicCode,
                    Title = topic.Title,
                    Committee = committee == null ? new StudentCommitteeDto() : new StudentCommitteeDto
                    {
                        CommitteeCode = committee.CommitteeCode,
                        Name = committee.Name,
                        DefenseDate = committee.DefenseDate,
                        Room = committee.Room,
                        Session = assignment?.Session,
                        StartTime = assignment?.StartTime,
                        EndTime = assignment?.EndTime,
                        Members = members
                    }
                };

                var res = ApiResponse<StudentDefenseInfoDto>.SuccessResponse(payload);
                res.HttpStatusCode = StatusCodes.Status200OK;
                return res;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "student defense failed");
                return ApiResponse<StudentDefenseInfoDto>.Fail("Không thể tải dữ liệu sinh viên", StatusCodes.Status500InternalServerError);
            }
        }
    }
}
