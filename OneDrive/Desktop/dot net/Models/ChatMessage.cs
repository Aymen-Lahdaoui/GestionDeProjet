using System.ComponentModel.DataAnnotations;

namespace ProjectManager.Models;

public enum MessageType 
{ 
    Direct, 
    Project 
}

public class ChatMessage
{
    public int Id { get; set; }

    [Required]
    public string SenderId { get; set; } = string.Empty;

    [Required]
    public string SenderName { get; set; } = string.Empty;

    [Required]
    public string Content { get; set; } = string.Empty;

    public DateTime SentAt { get; set; } = DateTime.UtcNow;

    public MessageType Type { get; set; }

    // Relationships
    public string? ReceiverId { get; set; } // For Direct messages
    public int? ProjectId { get; set; }   // For Project messages
    public Project? Project { get; set; }
}
