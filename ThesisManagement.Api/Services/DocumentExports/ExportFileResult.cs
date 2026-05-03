namespace ThesisManagement.Api.Services.DocumentExports;

public sealed record ExportFileResult(byte[] Content, string ContentType, string FileName);
