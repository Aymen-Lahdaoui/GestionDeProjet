using System.ComponentModel.DataAnnotations;

namespace ProjectManager.Models;

public class Comment
{
    public int Id { get; set; }

    [Required]
    [StringLength(2000)]
    public string Content { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Relations
    public int TaskId { get; set; }
    public ProjectManager.Models.Task? Task { get; set; }

    public int AuthorId { get; set; }
    public TeamMember? Author { get; set; }
}



