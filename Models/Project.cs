using System.ComponentModel.DataAnnotations;

namespace ProjectManager.Models;

public class Project
{
    public int Id { get; set; }

    [Required]
    [StringLength(200)]
    public string Name { get; set; } = string.Empty;

    [StringLength(1000)]
    public string? Description { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? Deadline { get; set; }

    public ProjectStatus Status { get; set; } = ProjectStatus.InProgress;

    // Relations
    public int TeamId { get; set; }
    public Team? Team { get; set; }

    public ICollection<ProjectManager.Models.Task> Tasks { get; set; } = new List<ProjectManager.Models.Task>();
}

public enum ProjectStatus
{
    NotStarted,
    InProgress,
    OnHold,
    Completed,
    Cancelled
}


