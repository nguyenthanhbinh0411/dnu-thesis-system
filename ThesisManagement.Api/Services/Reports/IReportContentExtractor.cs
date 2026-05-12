using System.Threading.Tasks;

namespace ThesisManagement.Api.Services.Reports
{
    public interface IReportContentExtractor
    {
        /// <summary>
        /// Trích xuất văn bản từ tệp báo cáo (PDF, DOCX)
        /// </summary>
        /// <param name="fileUrl">Đường dẫn tệp</param>
        /// <param name="studentDescription">Mô tả của sinh viên để dùng cho trích xuất thông minh</param>
        /// <param name="maxChars">Số lượng ký tự tối đa muốn lấy (mặc định 100,000)</param>
        /// <returns>Nội dung văn bản trích xuất được</returns>
        Task<string> ExtractTextAsync(string fileUrl, string? studentDescription = null, int maxChars = 100000);
    }
}
