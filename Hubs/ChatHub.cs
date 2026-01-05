using Microsoft.AspNetCore.SignalR;
using ProjectManager.Data;
using ProjectManager.Models;
using Microsoft.EntityFrameworkCore;

namespace ProjectManager.Hubs;

[Microsoft.AspNetCore.Authorization.Authorize]
public class ChatHub : Hub
{
    private readonly ApplicationDbContext _context;
    private readonly Microsoft.AspNetCore.Identity.UserManager<ApplicationUser> _userManager;

    private readonly ILogger<ChatHub> _logger;

    public ChatHub(ApplicationDbContext context, Microsoft.AspNetCore.Identity.UserManager<ApplicationUser> userManager, ILogger<ChatHub> logger)
    {
        _context = context;
        _userManager = userManager;
        _logger = logger;
    }

    public async System.Threading.Tasks.Task SendMessageToUser(string receiverId, string message)
    {
        try 
        {
            var senderId = Context.UserIdentifier;
            _logger.LogInformation($"[ChatHub] SendMessageToUser called. Sender: {senderId}, Receiver: {receiverId}, Message: {message}");

            // Resolve email to ID if needed
            if (receiverId.Contains("@"))
            {
                _logger.LogInformation($"[ChatHub] Resolving email {receiverId} to ID");
                var user = await _userManager.FindByEmailAsync(receiverId);
                if (user != null)
                {
                    receiverId = user.Id;
                    _logger.LogInformation($"[ChatHub] Resolved to {receiverId}");
                }
                else
                {
                    _logger.LogWarning($"[ChatHub] Could not resolve email {receiverId}");
                }
            }

            if (string.IsNullOrEmpty(senderId))
            {
                 _logger.LogError("[ChatHub] SenderId is null! User might not be authenticated.");
                 senderId = "Anonymous"; // This might cause DB error if constraints exist
            }
            
            var senderName = Context.User?.Identity?.Name ?? "Utilisateur";

            var chatMessage = new ChatMessage
            {
                SenderId = senderId,
                SenderName = senderName,
                Content = message,
                Type = MessageType.Direct,
                ReceiverId = receiverId,
                SentAt = DateTime.UtcNow
            };

            _context.ChatMessages.Add(chatMessage);
            await _context.SaveChangesAsync();
            _logger.LogInformation("[ChatHub] Message saved to DB");

            // Activity Logging
            string receiverName = receiverId;
            var receiverUser = await _userManager.FindByIdAsync(receiverId);
            if (receiverUser != null)
            {
               receiverName = receiverUser.UserName ?? receiverUser.Email;
            }
            await LogActivity("Message Chat", $"Message direct envoyé à '{receiverName}': \"{(message.Length > 30 ? message.Substring(0, 30) + "..." : message)}\"", "Chat", chatMessage.Id.ToString());

            // Send to receiver
            await Clients.User(receiverId).SendAsync("ReceiveMessage", chatMessage);
            
            // Send back to sender only if different (Clients.User already covers the user's connections)
            if (receiverId != senderId)
            {
                await Clients.Caller.SendAsync("ReceiveMessage", chatMessage);
            }
            _logger.LogInformation("[ChatHub] Message sent to clients");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[ChatHub] Error sending message to user");
            throw new HubException($"Server Error: {ex.Message} | Inner: {ex.InnerException?.Message}");
        }
    }

    public async System.Threading.Tasks.Task SendMessageToProject(int projectId, string message)
    {
        var senderId = Context.UserIdentifier ?? "Anonymous";
        var senderName = Context.User?.Identity?.Name ?? "Utilisateur";

        var chatMessage = new ChatMessage
        {
            SenderId = senderId,
            SenderName = senderName,
            Content = message,
            Type = MessageType.Project,
            ProjectId = projectId,
            SentAt = DateTime.UtcNow
        };

        _context.ChatMessages.Add(chatMessage);
        await _context.SaveChangesAsync();

        // Activity Logging
        var project = await _context.Projects.FindAsync(projectId);
        string projectName = project?.Name ?? $"ID {projectId}";
        await LogActivity("Message Projet", $"Message envoyé au projet '{projectName}': \"{(message.Length > 30 ? message.Substring(0, 30) + "..." : message)}\"", "Chat", chatMessage.Id.ToString());

        await Clients.Group(projectId.ToString()).SendAsync("ReceiveMessage", chatMessage);
    }

    public async System.Threading.Tasks.Task JoinProject(int projectId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, projectId.ToString());
    }

    public async System.Threading.Tasks.Task LeaveProject(int projectId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, projectId.ToString());
    }

    public async System.Threading.Tasks.Task DeleteMessage(int messageId)
    {
        var userId = Context.UserIdentifier;
        if (string.IsNullOrEmpty(userId)) throw new HubException("Unauthorized");

        var msg = await _context.ChatMessages.FindAsync(messageId);
        if (msg == null) return;

        if (msg.SenderId != userId) throw new HubException("You can only delete your own messages.");

        // 1-hour limit check
        if (msg.SentAt < DateTime.UtcNow.AddHours(-1))
        {
            throw new HubException("Messages older than 1 hour cannot be deleted.");
        }

        _context.ChatMessages.Remove(msg);
        await _context.SaveChangesAsync();

        // Activity Logging
        await LogActivity("Suppression de Message", $"Message supprime (ID: {messageId})", "Chat", messageId.ToString());

        if (msg.Type == MessageType.Direct)
        {
             // Notify Receiver
             if (!string.IsNullOrEmpty(msg.ReceiverId))
             {
                await Clients.User(msg.ReceiverId).SendAsync("MessageDeleted", messageId);
             }
             // Notify Sender (Me)
             await Clients.Caller.SendAsync("MessageDeleted", messageId);
        }
        else 
        {
             await Clients.Group(msg.ProjectId.ToString()).SendAsync("MessageDeleted", messageId);
        }
    }

    private async System.Threading.Tasks.Task LogActivity(string action, string details, string entityType = null, string entityId = null)
    {
        try
        {
            var userEmail = Context.User?.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value ?? "system@projet.com";
            var userName = Context.User?.Identity?.Name ?? userEmail;

            var log = new ActivityLog
            {
                UserEmail = userEmail,
                UserName = userName,
                Action = action,
                Details = details,
                Timestamp = DateTime.UtcNow,
                EntityType = entityType,
                EntityId = entityId
            };

            _context.ActivityLogs.Add(log);
            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error logging activity in ChatHub");
        }
    }
}
