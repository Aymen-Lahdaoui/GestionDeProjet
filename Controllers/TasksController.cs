using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectManager.Data;
using ProjectManager.Models;
using TaskModel = ProjectManager.Models.Task;
using System.Security.Claims;
using System.Linq;

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

        await LogActivity("Création de tâche", $"La tâche '{task.Title}' a été créée.", "Task", task.Id.ToString());

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

        // Get the original task to detect changes
        var originalTask = await _context.Tasks.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id);
        if (originalTask == null)
        {
            return NotFound();
        }

        _context.Entry(task).State = EntityState.Modified;

        try
        {
            await _context.SaveChangesAsync();
            
            // Detect specific changes for better logging
            if (originalTask.Status != task.Status)
            {
                var statusLabels = new Dictionary<ProjectManager.Models.TaskStatus, string>
                {
                    { ProjectManager.Models.TaskStatus.ToDo, "À faire" },
                    { ProjectManager.Models.TaskStatus.InProgress, "En cours" },
                    { ProjectManager.Models.TaskStatus.InReview, "En revue" },
                    { ProjectManager.Models.TaskStatus.Done, "Terminé" }
                };
                
                var oldStatus = statusLabels.ContainsKey(originalTask.Status) ? statusLabels[originalTask.Status] : "Inconnu";
                var newStatus = statusLabels.ContainsKey(task.Status) ? statusLabels[task.Status] : "Inconnu";
                await LogActivity("Changement de statut", $"Tâche '{task.Title}' : {oldStatus} → {newStatus}", "Task", task.Id.ToString());
            }
            else
            {
                await LogActivity("Modification de tâche", $"La tâche '{task.Title}' a été mise à jour.", "Task", task.Id.ToString());
            }
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

        await LogActivity("Suppression de tâche", $"La tâche '{task.Title}' a été supprimée.", "Task", id.ToString());

        return NoContent();
    }

    private async System.Threading.Tasks.Task LogActivity(string action, string details, string? entityType = null, string? entityId = null)
    {
        try
        {
            var userEmail = User.FindFirst(ClaimTypes.Email)?.Value;
            var userName = User.FindFirst(ClaimTypes.Name)?.Value ?? userEmail;

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
            Console.WriteLine($"[Error Logging Activity] {ex.Message}");
        }
    }

    private bool TaskExists(int id)
    {
        return _context.Tasks.Any(e => e.Id == id);
    }
}

