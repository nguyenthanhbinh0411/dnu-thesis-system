using System.Security.Cryptography;
using CG.Web.MegaApiClient;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Caching.Memory;
using ThesisManagement.Api.Application.Common;

namespace ThesisManagement.Api.Services.FileStorage
{
    public sealed class FileStorageService : IFileStorageService
    {
        private const string ManagedRoutePrefix = "/api/storage/mega/";

        private readonly IWebHostEnvironment _env;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly ILogger<FileStorageService> _logger;
        private readonly FileStorageOptions _options;
        private readonly IMemoryCache _cache;
        private readonly MegaApiClient _megaClient = new();
        private readonly SemaphoreSlim _megaLoginLock = new(1, 1);

        private const string MegaNodesCacheKey = "MegaNodesCache";

        public FileStorageService(
            IWebHostEnvironment env,
            IHttpContextAccessor httpContextAccessor,
            IOptions<FileStorageOptions> options,
            ILogger<FileStorageService> logger,
            IMemoryCache cache)
        {
            _env = env;
            _httpContextAccessor = httpContextAccessor;
            _logger = logger;
            _options = options.Value;
            _cache = cache;
        }

        public long MaxUploadSizeBytes => _options.MaxUploadSizeBytes <= 0 ? 10 * 1024 * 1024 : _options.MaxUploadSizeBytes;

        public bool IsManagedUrl(string? url)
            => TryParseManagedNodeId(url, out _);

        public string? ToAbsoluteUrl(string? url)
        {
            if (string.IsNullOrWhiteSpace(url))
                return url;

            if (Uri.TryCreate(url, UriKind.Absolute, out _))
                return url;

            var baseUrl = _options.PublicBaseUrl?.TrimEnd('/');
            if (string.IsNullOrWhiteSpace(baseUrl))
            {
                var request = _httpContextAccessor.HttpContext?.Request;
                if (request != null)
                {
                    baseUrl = $"{request.Scheme}://{request.Host}";
                }
            }

            if (string.IsNullOrWhiteSpace(baseUrl))
                return url;

            return $"{baseUrl}{url}";
        }

        public async Task<OperationResult<string>> UploadAsync(IFormFile file, string scope, CancellationToken cancellationToken = default, bool allowLocalFallback = true)
        {
            if (file == null || file.Length == 0)
                return OperationResult<string>.Failed("File is required", 400);

            if (file.Length > MaxUploadSizeBytes)
                return OperationResult<string>.Failed($"File must not exceed {MaxUploadSizeBytes / (1024 * 1024)}MB", 400);

            var safeScope = NormalizeScope(scope);
            var extension = Path.GetExtension(Path.GetFileName(file.FileName));

            await using var memory = new MemoryStream();
            await file.CopyToAsync(memory, cancellationToken);
            var content = memory.ToArray();
            var hash = Convert.ToHexString(SHA256.HashData(content)).ToLowerInvariant();
            var storageFileName = string.IsNullOrWhiteSpace(extension) ? hash : $"{hash}{extension.ToLowerInvariant()}";

            var managedUrl = await TryUploadToMegaAsync(content, storageFileName, safeScope, cancellationToken);
            if (!string.IsNullOrWhiteSpace(managedUrl))
                return OperationResult<string>.Succeeded(managedUrl, 201);

            if (!allowLocalFallback)
                return OperationResult<string>.Failed("Mega upload failed", 503);

            var localUrl = await SaveLocalAsync(content, safeScope, storageFileName, cancellationToken);
            return OperationResult<string>.Succeeded(localUrl, 201);
        }

        public async Task<OperationResult<FileStorageReadResult>> OpenReadAsync(string? url, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(url))
                return OperationResult<FileStorageReadResult>.Failed("File URL not set", 404);

            if (TryParseManagedNodeId(url, out var nodeId))
                return await DownloadManagedAsync(nodeId, cancellationToken);

            var localPath = ResolveLocalPath(url);
            if (string.IsNullOrWhiteSpace(localPath) || !File.Exists(localPath))
                return OperationResult<FileStorageReadResult>.Failed("File not found on disk", 404);

            var stream = File.OpenRead(localPath);
            var contentType = GetContentType(localPath);
            var fileName = Path.GetFileName(localPath);
            return OperationResult<FileStorageReadResult>.Succeeded(new FileStorageReadResult(stream, contentType, fileName));
        }

        public async Task<OperationResult<object?>> DeleteAsync(string? url, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(url))
                return OperationResult<object?>.Succeeded(null);

            if (TryParseManagedNodeId(url, out var nodeId))
            {
                var nodesResult = await GetMegaNodesAsync(cancellationToken);
                if (!nodesResult.Success)
                    return OperationResult<object?>.Failed(nodesResult.ErrorMessage ?? "Unable to read Mega nodes", nodesResult.StatusCode);

                var node = nodesResult.Data!.FirstOrDefault(x => string.Equals(x.Id, nodeId, StringComparison.OrdinalIgnoreCase));
                if (node == null)
                    return OperationResult<object?>.Succeeded(null);

                await EnsureMegaLoggedInAsync(cancellationToken);
                await _megaClient.DeleteAsync(node, false);
                _cache.Remove(MegaNodesCacheKey);
                return OperationResult<object?>.Succeeded(null);
            }

            var localPath = ResolveLocalPath(url);
            if (!string.IsNullOrWhiteSpace(localPath) && File.Exists(localPath))
            {
                File.Delete(localPath);
            }

            return OperationResult<object?>.Succeeded(null);
        }

        public async Task<OperationResult<string>> MoveAsync(string? url, string targetScope, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(url))
                return OperationResult<string>.Failed("File URL not set", 404);

            if (TryParseManagedNodeId(url, out var nodeId))
            {
                var nodesResult = await GetMegaNodesAsync(cancellationToken);
                if (!nodesResult.Success)
                    return OperationResult<string>.Failed(nodesResult.ErrorMessage ?? "Unable to read Mega nodes", nodesResult.StatusCode);

                var node = nodesResult.Data!.FirstOrDefault(x => string.Equals(x.Id, nodeId, StringComparison.OrdinalIgnoreCase));
                if (node == null)
                    return OperationResult<string>.Failed("File not found", 404);

                await EnsureMegaLoggedInAsync(cancellationToken);
                var destinationFolder = await EnsureMegaFolderAsync(NormalizeScope(targetScope), cancellationToken);
                await _megaClient.MoveAsync(node, destinationFolder!);
                _cache.Remove(MegaNodesCacheKey);
                return OperationResult<string>.Succeeded(BuildManagedUrl(node.Id), 200);
            }

            var localPath = ResolveLocalPath(url);
            if (string.IsNullOrWhiteSpace(localPath) || !File.Exists(localPath))
                return OperationResult<string>.Failed("File not found", 404);

            var fileName = Path.GetFileName(localPath);
            var fileBytes = await File.ReadAllBytesAsync(localPath, cancellationToken);
            var targetFolder = Path.Combine(GetLocalRootPath(), NormalizeScope(targetScope));
            Directory.CreateDirectory(targetFolder);
            var targetPath = Path.Combine(targetFolder, fileName);
            await File.WriteAllBytesAsync(targetPath, fileBytes, cancellationToken);
            File.Delete(localPath);

            var relativeUrl = $"/{NormalizeScope(targetScope)}/{fileName}".Replace("//", "/", StringComparison.Ordinal);
            return OperationResult<string>.Succeeded(ToAbsoluteUrl(relativeUrl) ?? relativeUrl, 200);
        }

        public async Task<OperationResult<IReadOnlyList<FileStorageListItem>>> ListAsync(string scope, CancellationToken cancellationToken = default)
        {
            var normalizedScope = NormalizeScope(scope);
            if (UseMegaStorage())
            {
                var folderResult = await EnsureMegaFolderAsync(normalizedScope, cancellationToken, createIfMissing: false);
                if (folderResult == null)
                    return OperationResult<IReadOnlyList<FileStorageListItem>>.Succeeded(Array.Empty<FileStorageListItem>());

                var megaItems = (await _megaClient.GetNodesAsync(folderResult))
                    .Where(x => x.Type == NodeType.File)
                    .Select(x => new FileStorageListItem(
                        x.Id,
                        x.Name,
                        BuildManagedUrl(x.Id),
                        x.Size,
                        x.ModificationDate,
                        "mega"))
                    .ToList();

                return OperationResult<IReadOnlyList<FileStorageListItem>>.Succeeded(megaItems);
            }

            var folderPath = Path.Combine(GetLocalRootPath(), normalizedScope);
            if (!Directory.Exists(folderPath))
                return OperationResult<IReadOnlyList<FileStorageListItem>>.Succeeded(Array.Empty<FileStorageListItem>());

            var items = Directory.EnumerateFiles(folderPath)
                .Select(path => new FileStorageListItem(
                    Path.GetFileName(path),
                    Path.GetFileName(path),
                    ToAbsoluteUrl($"/{normalizedScope}/{Path.GetFileName(path)}") ?? $"/{normalizedScope}/{Path.GetFileName(path)}",
                    new FileInfo(path).Length,
                    File.GetLastWriteTimeUtc(path),
                    "local"))
                .ToList();

            return OperationResult<IReadOnlyList<FileStorageListItem>>.Succeeded(items);
        }

        private bool UseMegaStorage()
            => _options.EnableMega
                && !string.IsNullOrWhiteSpace(_options.MegaEmail)
                && !string.IsNullOrWhiteSpace(_options.MegaPassword);

        private string GetLocalRootPath()
            => _env.WebRootPath ?? Path.Combine(AppContext.BaseDirectory, "wwwroot");

        private async Task<string> SaveLocalAsync(byte[] content, string scope, string fileName, CancellationToken cancellationToken)
        {
            var folder = Path.Combine(GetLocalRootPath(), scope);
            Directory.CreateDirectory(folder);

            var targetPath = Path.Combine(folder, fileName);
            if (!File.Exists(targetPath))
            {
                await File.WriteAllBytesAsync(targetPath, content, cancellationToken);
            }

            var relativeUrl = $"/{scope}/{fileName}".Replace("//", "/", StringComparison.Ordinal);
            return ToAbsoluteUrl(relativeUrl) ?? relativeUrl;
        }

        private string ResolveLocalPath(string url)
        {
            var path = url;
            if (Uri.TryCreate(url, UriKind.Absolute, out var absolute))
            {
                path = absolute.AbsolutePath;
            }

            path = path.TrimStart('/');
            if (path.StartsWith("api/storage/mega/", StringComparison.OrdinalIgnoreCase))
                return string.Empty;

            return Path.Combine(GetLocalRootPath(), path.Replace('/', Path.DirectorySeparatorChar));
        }

        private async Task<string?> TryUploadToMegaAsync(byte[] content, string fileName, string scope, CancellationToken cancellationToken)
        {
            if (!UseMegaStorage())
                return null;

            try
            {
                await EnsureMegaLoggedInAsync(cancellationToken);
                var folder = await EnsureMegaFolderAsync(scope, cancellationToken);
                var existing = (await _megaClient.GetNodesAsync(folder!))
                    .FirstOrDefault(x => x.Type == NodeType.File && string.Equals(x.Name, fileName, StringComparison.OrdinalIgnoreCase) && x.Size == content.LongLength);

                if (existing != null)
                {
                    return BuildManagedUrl(existing.Id);
                }

                await using var stream = new MemoryStream(content);
                var created = await _megaClient.UploadAsync(stream, fileName, folder!, null, null, cancellationToken);
                _cache.Remove(MegaNodesCacheKey);
                return BuildManagedUrl(created.Id);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Mega upload failed. Falling back to local storage for scope {Scope}.", scope);
                return null;
            }
        }

        private async Task<OperationResult<IReadOnlyList<INode>>> GetMegaNodesAsync(CancellationToken cancellationToken)
        {
            if (!UseMegaStorage())
                return OperationResult<IReadOnlyList<INode>>.Failed("Mega storage is not configured", 503);

            if (_cache.TryGetValue(MegaNodesCacheKey, out List<INode>? cachedNodes) && cachedNodes != null)
            {
                return OperationResult<IReadOnlyList<INode>>.Succeeded(cachedNodes);
            }

            try
            {
                await EnsureMegaLoggedInAsync(cancellationToken);
                var nodes = _megaClient.GetNodes().ToList();
                _cache.Set(MegaNodesCacheKey, nodes, TimeSpan.FromMinutes(30));
                return OperationResult<IReadOnlyList<INode>>.Succeeded(nodes);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Unable to read Mega nodes.");
                return OperationResult<IReadOnlyList<INode>>.Failed("Unable to read Mega nodes", 503);
            }
        }

        private async Task<OperationResult<FileStorageReadResult>> DownloadManagedAsync(string nodeId, CancellationToken cancellationToken)
        {
            try
            {
                var cacheFolder = Path.Combine(GetLocalRootPath(), "cache", "mega");
                Directory.CreateDirectory(cacheFolder);

                // Try to find in cache first (any file starting with nodeId)
                var cachedFile = Directory.EnumerateFiles(cacheFolder, $"{nodeId}*").FirstOrDefault();
                if (cachedFile != null)
                {
                    var stream = File.OpenRead(cachedFile);
                    return OperationResult<FileStorageReadResult>.Succeeded(new FileStorageReadResult(
                        stream,
                        GetContentType(cachedFile),
                        Path.GetFileName(cachedFile)));
                }

                await EnsureMegaLoggedInAsync(cancellationToken);
                var node = _megaClient.GetNodes().FirstOrDefault(x => string.Equals(x.Id, nodeId, StringComparison.OrdinalIgnoreCase));
                if (node == null)
                    return OperationResult<FileStorageReadResult>.Failed("File not found", 404);

                var remoteStream = await _megaClient.DownloadAsync(node, null, cancellationToken);
                var memory = new MemoryStream();
                await remoteStream.CopyToAsync(memory, cancellationToken);
                memory.Position = 0;

                // Save to cache asynchronously without blocking the return (optional, but let's do it safely)
                try
                {
                    var extension = Path.GetExtension(node.Name);
                    var cachePath = Path.Combine(cacheFolder, $"{node.Id}{extension}");
                    await File.WriteAllBytesAsync(cachePath, memory.ToArray(), cancellationToken);
                }
                catch (Exception cacheEx)
                {
                    _logger.LogWarning(cacheEx, "Failed to save Mega node {NodeId} to cache.", nodeId);
                }

                return OperationResult<FileStorageReadResult>.Succeeded(new FileStorageReadResult(
                    memory,
                    GetContentType(node.Name),
                    node.Name));
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Unable to download Mega node {NodeId}.", nodeId);
                return OperationResult<FileStorageReadResult>.Failed("File not found", 404);
            }
        }

        private async Task<INode?> EnsureMegaFolderAsync(string scope, CancellationToken cancellationToken, bool createIfMissing = true)
        {
            await EnsureMegaLoggedInAsync(cancellationToken);

            var nodesResult = await GetMegaNodesAsync(cancellationToken);
            if (!nodesResult.Success) return null;
            var nodes = nodesResult.Data!;
            var root = nodes.FirstOrDefault(x => x.Type == NodeType.Root)
                ?? nodes.FirstOrDefault(x => x.Type == NodeType.Inbox)
                ?? throw new InvalidOperationException("Mega root node not found");

            INode current = root;

            var segments = new List<string>();
            if (!string.IsNullOrWhiteSpace(_options.MegaRootFolder))
                segments.AddRange(SplitScope(_options.MegaRootFolder));
            segments.AddRange(SplitScope(scope));

            foreach (var segment in segments)
            {
                var existing = nodes.FirstOrDefault(x =>
                    x.Type == NodeType.Directory &&
                    string.Equals(x.ParentId, current.Id, StringComparison.OrdinalIgnoreCase) &&
                    string.Equals(x.Name, segment, StringComparison.OrdinalIgnoreCase));

                if (existing == null)
                {
                    if (!createIfMissing)
                        return null;

                    existing = await _megaClient.CreateFolderAsync(segment, current);
                    _cache.Remove(MegaNodesCacheKey);
                    var refreshedNodesResult = await GetMegaNodesAsync(cancellationToken);
                    nodes = refreshedNodesResult.Data ?? new List<INode>();
                }

                current = existing;
            }

            return current;
        }

        private async Task EnsureMegaLoggedInAsync(CancellationToken cancellationToken = default)
        {
            if (!UseMegaStorage())
                throw new InvalidOperationException("Mega storage is not configured");

            if (_megaClient.IsLoggedIn)
                return;

            await _megaLoginLock.WaitAsync(cancellationToken);
            try
            {
                if (_megaClient.IsLoggedIn)
                    return;

                var mfa = string.IsNullOrWhiteSpace(_options.MegaMfaKey) ? null : _options.MegaMfaKey;
                await _megaClient.LoginAsync(_options.MegaEmail!, _options.MegaPassword!, mfa);
            }
            finally
            {
                _megaLoginLock.Release();
            }
        }

        private static string NormalizeScope(string scope)
        {
            var normalized = string.Join('/', SplitScope(scope));
            return string.IsNullOrWhiteSpace(normalized) ? "uploads" : normalized;
        }

        private static IEnumerable<string> SplitScope(string scope)
            => (scope ?? string.Empty)
                .Split(new[] { '/', '\\' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(x => !string.IsNullOrWhiteSpace(x));

        private string BuildManagedUrl(string nodeId)
            => ToAbsoluteUrl($"{ManagedRoutePrefix}{nodeId}") ?? $"{ManagedRoutePrefix}{nodeId}";

        private static bool TryParseManagedNodeId(string? url, out string nodeId)
        {
            nodeId = string.Empty;

            if (string.IsNullOrWhiteSpace(url))
                return false;

            var path = url;
            if (Uri.TryCreate(url, UriKind.Absolute, out var absolute))
            {
                path = absolute.AbsolutePath;
            }

            if (!path.StartsWith(ManagedRoutePrefix, StringComparison.OrdinalIgnoreCase))
                return false;

            var segments = path.Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            if (segments.Length < 4)
                return false;

            nodeId = segments[3];
            return !string.IsNullOrWhiteSpace(nodeId);
        }

        private static string GetContentType(string fileName)
        {
            var extension = Path.GetExtension(fileName).ToLowerInvariant();
            return extension switch
            {
                ".jpg" or ".jpeg" => "image/jpeg",
                ".png" => "image/png",
                ".gif" => "image/gif",
                ".bmp" => "image/bmp",
                ".webp" => "image/webp",
                ".pdf" => "application/pdf",
                ".txt" => "text/plain",
                ".doc" => "application/msword",
                ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                ".xls" => "application/vnd.ms-excel",
                ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                _ => "application/octet-stream"
            };
        }
    }
}