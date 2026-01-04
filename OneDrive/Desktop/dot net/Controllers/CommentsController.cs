using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectManager.Data;
using ProjectManager.Models;

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

        return NoContent();
    }

    private bool CommentExists(int id)
    {
        return _context.Comments.Any(e => e.Id == id);
    }
}


