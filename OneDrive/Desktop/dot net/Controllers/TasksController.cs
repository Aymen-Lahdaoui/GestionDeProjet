using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectManager.Data;
using ProjectManager.Models;
using ProjectManager.Models;
using TaskModel = ProjectManager.Models.Task;
using System.Security.Claims;

namespace ProjectManager.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class TasksController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public TasksController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async System.Threading.Tasks.Task<ActionResult<IEnumerable<TaskModel>>> GetTasks()
    {
        var canSeeAll = User.Identity?.IsAuthenticated == true && (User.IsInRole("Admin") || User.IsInRole("Sous-Admin"));
        var userEmail = User.FindFirstValue(ClaimTypes.Email)?.ToLower() ?? "";

        var query = _context.Tasks
            .Include(t => t.Project)
            .Include(t => t.AssignedTo)
            .Include(t => t.Comments)
                .ThenInclude(c => c.Author)
            .AsQueryable();

        if (!canSeeAll)
        {
            query = query.Where(t => t.AssignedTo != null && t.AssignedTo.Email.ToLower() == userEmail);
        }

        return await query.ToListAsync();
    }

    // GET: api/Tasks/5
    [HttpGet("{id}")]
    public async System.Threading.Tasks.Task<ActionResult<TaskModel>> GetTask(int id)
    {
        var task = await _context.Tasks
            .Include(t => t.Project)
            .Include(t => t.AssignedTo)
            .Include(t => t.Comments)
                .ThenInclude(c => c.Author)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (task == null)
        {
            return NotFound();
        }

        return task;
    }

    // GET: api/Tasks/project/5
    [HttpGet("project/{projectId}")]
    public async System.Threading.Tasks.Task<ActionResult<IEnumerable<TaskModel>>> GetTasksByProject(int projectId)
    {
        return await _context.Tasks
            .Where(t => t.ProjectId == projectId)
            .Include(t => t.AssignedTo)
            .Include(t => t.Comments)
            .ToListAsync();
    }

    // GET: api/Tasks/member/5
    [HttpGet("member/{memberId}")]
    public async System.Threading.Tasks.Task<ActionResult<IEnumerable<TaskModel>>> GetTasksByMember(int memberId)
    {
        return await _context.Tasks
            .Where(t => t.AssignedToId == memberId)
            .Include(t => t.Project)
            .Include(t => t.Comments)
            .ToListAsync();
    }

    // POST: api/Tasks
    [Authorize(Roles = "Admin,Sous-Admin,Chef de Projet")]
    [HttpPost]
    public async System.Threading.Tasks.Task<ActionResult<TaskModel>> PostTask(TaskModel task)
    {
        task.CreatedAt = DateTime.UtcNow;
        _context.Tasks.Add(task);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetTask), new { id = task.Id }, task);
    }

    // PUT: api/Tasks/5
    [HttpPut("{id}")]
    public async System.Threading.Tasks.Task<IActionResult> PutTask(int id, TaskModel task)
    {
        if (id != task.Id)
        {
            return BadRequest();
        }

        _context.Entry(task).State = EntityState.Modified;

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            if (!TaskExists(id))
            {
                return NotFound();
            }
            throw;
        }

        return NoContent();
    }

    // DELETE: api/Tasks/5
    [Authorize(Roles = "Admin,Sous-Admin,Chef de Projet")]
    [HttpDelete("{id}")]
    public async System.Threading.Tasks.Task<IActionResult> DeleteTask(int id)
    {
        var task = await _context.Tasks.FindAsync(id);
        if (task == null)
        {
            return NotFound();
        }

        _context.Tasks.Remove(task);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    private bool TaskExists(int id)
    {
        return _context.Tasks.Any(e => e.Id == id);
    }
}

