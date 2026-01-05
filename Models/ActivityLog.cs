using System;

namespace ProjectManager.Models;

public class ActivityLog
{
    public int Id { get; set; }
    public string? UserEmail { get; set; }
    public string? UserName { get; set; }
    public string Action { get; set; } = string.Empty;
    public string? Details { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public string? EntityType { get; set; }
    public string? EntityId { get; set; }
}
