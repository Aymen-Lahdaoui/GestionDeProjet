using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectManager.Data;
using ProjectManager.Models;
using System.Security.Claims;

namespace ProjectManager.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class ChatController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly Microsoft.AspNetCore.Identity.UserManager<ApplicationUser> _userManager;

    public ChatController(ApplicationDbContext context, Microsoft.AspNetCore.Identity.UserManager<ApplicationUser> userManager)
    {
        _context = context;
        _userManager = userManager;
    }

    [HttpGet("direct/{userId}")]
    public async System.Threading.Tasks.Task<ActionResult<IEnumerable<ChatMessage>>> GetDirectMessages(string userId)
    {
        if (userId.Contains("@"))
        {
            var user = await _userManager.FindByEmailAsync(userId);
            if (user != null) userId = user.Id;
        }
        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (currentUserId == null) return Unauthorized();

        var messages = await _context.ChatMessages
            .Where(m => m.Type == MessageType.Direct &&
                        ((m.SenderId == currentUserId && m.ReceiverId == userId) ||
                         (m.SenderId == userId && m.ReceiverId == currentUserId)))
            .OrderBy(m => m.SentAt)
            .ToListAsync();

        return Ok(messages);
    }

    [HttpGet("project/{projectId}")]
    public async System.Threading.Tasks.Task<ActionResult<IEnumerable<ChatMessage>>> GetProjectMessages(int projectId)
    {
        var messages = await _context.ChatMessages
            .Where(m => m.Type == MessageType.Project && m.ProjectId == projectId)
            .OrderBy(m => m.SentAt)
            .ToListAsync();

        return Ok(messages);
    }
}
