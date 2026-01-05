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
public class CommentsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public CommentsController(ApplicationDbContext context)
    {
        _context = context;
    }

    // GET: api/Comments
    [HttpGet]
    public async System.Threading.Tasks.Task<ActionResult<IEnumerable<Comment>>> GetComments()
    {
        return await _context.Comments
            .Include(c => c.Author)
            .Include(c => c.Task)
            .ToListAsync();
    }

    // GET: api/Comments/5
    [HttpGet("{id}")]
    public async System.Threading.Tasks.Task<ActionResult<Comment>> GetComment(int id)
    {
        var comment = await _context.Comments
            .Include(c => c.Author)
            .Include(c => c.Task)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (comment == null)
        {
            return NotFound();
        }

        return comment;
    }

    // GET: api/Comments/task/5
    [HttpGet("task/{taskId}")]
    public async System.Threading.Tasks.Task<ActionResult<IEnumerable<Comment>>> GetCommentsByTask(int taskId)
    {
        return await _context.Comments
            .Where(c => c.TaskId == taskId)
            .Include(c => c.Author)
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync();
    }

    // POST: api/Comments
    [HttpPost]
    public async System.Threading.Tasks.Task<ActionResult<Comment>> PostComment(Comment comment)
    {
        comment.CreatedAt = DateTime.UtcNow;
        _context.Comments.Add(comment);
        await _context.SaveChangesAsync();

        // Activity Logging
        var task = await _context.Tasks.FindAsync(comment.TaskId);
        await LogActivity("Nouveau Commentaire", $"Commentaire ajouté sur la tâche '{task?.Title ?? "Inconnue"}' : \"{comment.Content}\"", "Comment", comment.Id.ToString());

        return CreatedAtAction(nameof(GetComment), new { id = comment.Id }, comment);
    }

    // PUT: api/Comments/5
    [HttpPut("{id}")]
    public async System.Threading.Tasks.Task<IActionResult> PutComment(int id, Comment comment)
    {
        if (id != comment.Id)
        {
            return BadRequest();
        }

        _context.Entry(comment).State = EntityState.Modified;

        try
        {
            await _context.SaveChangesAsync();
            await LogActivity("Modification de Commentaire", $"Le commentaire ID {id} a été modifié.", "Comment", id.ToString());
        }
        catch (DbUpdateConcurrencyException)
        {
            if (!CommentExists(id))
            {
                return NotFound();
            }
            throw;
        }

        return NoContent();
    }

    // DELETE: api/Comments/5
    [HttpDelete("{id}")]
    public async System.Threading.Tasks.Task<IActionResult> DeleteComment(int id)
    {
        var comment = await _context.Comments.FindAsync(id);
        if (comment == null)
        {
            return NotFound();
        }

        _context.Comments.Remove(comment);
        await _context.SaveChangesAsync();

        // Activity Logging
        await LogActivity("Suppression de Commentaire", $"Un commentaire a été supprimé.", "Comment", id.ToString());

        return NoContent();
    }

    private async System.Threading.Tasks.Task LogActivity(string action, string details, string entityType = null, string entityId = null)
    {
        try
        {
            var userEmail = User.FindFirst(ClaimTypes.Email)?.Value ?? "system@projet.com";
            var userName = User.Identity?.Name ?? userEmail;

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
            // Fail silently to not block the main operation
            Console.WriteLine($"Logging Error: {ex.Message}");
        }
    }

    private bool CommentExists(int id)
    {
        return _context.Comments.Any(e => e.Id == id);
    }
}


