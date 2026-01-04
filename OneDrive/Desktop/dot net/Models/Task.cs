using System.ComponentModel.DataAnnotations;

namespace ProjectManager.Models;

public class Task
{
    public int Id { get; set; }

    [Required]
    [StringLength(200)]
    public string Title { get; set; } = string.Empty;

    [StringLength(1000)]
    public string? Description { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? Deadline { get; set; }

    public TaskPriority Priority { get; set; } = TaskPriority.Medium;

    public TaskStatus Status { get; set; } = TaskStatus.ToDo;

    // Relations
    public int ProjectId { get; set; }
    public Project? Project { get; set; }

    public int? AssignedToId { get; set; }
    public TeamMember? AssignedTo { get; set; }

    public ICollection<Comment> Comments { get; set; } = new List<Comment>();
}

public enum TaskPriority
{
    Low,
    Medium,
    High,
    Critical
}

public enum TaskStatus
{
    ToDo,
    InProgress,
    InReview,
    Done
}


