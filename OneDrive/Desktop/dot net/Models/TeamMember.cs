using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectManager.Models;

public class TeamMember
{
    public int Id { get; set; }

    [Required]
    [StringLength(100)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    [StringLength(200)]
    public string Email { get; set; } = string.Empty;

    [StringLength(50)]
    public string? Role { get; set; }

    // Relations
    public int? TeamId { get; set; }
    public Team? Team { get; set; }

    public ICollection<ProjectManager.Models.Task> AssignedTasks { get; set; } = new List<ProjectManager.Models.Task>();
    public ICollection<Comment> Comments { get; set; } = new List<Comment>();

    [NotMapped]
    public string? UserId { get; set; }
}


