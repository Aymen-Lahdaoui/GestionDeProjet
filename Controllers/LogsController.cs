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
public class LogsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public LogsController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    [Authorize(Roles = "Admin,Sous-Admin")]
    public async Task<ActionResult<IEnumerable<ActivityLog>>> GetLogs()
    {
        // For now, let's limit to 100 most recent logs
        return await _context.ActivityLogs
            .OrderByDescending(l => l.Timestamp)
            .Take(100)
            .ToListAsync();
    }

    [HttpDelete("clear")]
    [Authorize(Roles = "Admin,Sous-Admin")]
    public async Task<IActionResult> ClearLogs()
    {
        _context.ActivityLogs.RemoveRange(_context.ActivityLogs);
        await _context.SaveChangesAsync();
        return NoContent();
    }
}
