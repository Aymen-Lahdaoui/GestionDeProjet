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
public class ProjectsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public ProjectsController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async System.Threading.Tasks.Task<ActionResult<IEnumerable<Project>>> GetProjects()
    {
        var canSeeAll = User.Identity?.IsAuthenticated == true && (User.IsInRole("Admin") || User.IsInRole("Sous-Admin"));
        var userEmail = User.FindFirstValue(ClaimTypes.Email)?.ToLower() ?? "";

        // Diagnostic logging
        Console.WriteLine($"[ProjectsController] User: {userEmail}");
        Console.WriteLine($"[ProjectsController] CanSeeAll: {canSeeAll}");
        Console.WriteLine($"[ProjectsController] IsAuthenticated: {User.Identity?.IsAuthenticated}");
        Console.WriteLine($"[ProjectsController] IsAdmin: {User.IsInRole("Admin")}");
        Console.WriteLine($"[ProjectsController] IsSousAdmin: {User.IsInRole("Sous-Admin")}");
        Console.WriteLine($"[ProjectsController] IsChefDeProjet: {User.IsInRole("Chef de Projet")}");

        var query = _context.Projects
            .Include(p => p.Team)
                .ThenInclude(t => t.Members)
            .Include(p => p.Tasks)
            .AsQueryable();

        if (!canSeeAll)
        {
            var userMember = await _context.TeamMembers.FirstOrDefaultAsync(m => m.Email.ToLower() == userEmail);
            Console.WriteLine($"[ProjectsController] UserMember found: {userMember != null}");
            if (userMember != null)
            {
                Console.WriteLine($"[ProjectsController] UserMember TeamId: {userMember.TeamId}");
                Console.WriteLine($"[ProjectsController] UserMember Name: {userMember.Name}");
            }
            
            if (userMember == null || userMember.TeamId == null)
            {
                Console.WriteLine($"[ProjectsController] Returning empty list - no team assignment");
                return new List<Project>();
            }
            query = query.Where(p => p.TeamId == userMember.TeamId);
        }

        var results = await query.ToListAsync();
        Console.WriteLine($"[ProjectsController] Returning {results.Count} projects");
        foreach (var p in results)
        {
            Console.WriteLine($"[ProjectsController] - Project: {p.Name}, TeamId: {p.TeamId}, Team: {p.Team?.Name}");
        }

        return results;
    }

    // GET: api/Projects/5
    [HttpGet("{id}")]
    public async System.Threading.Tasks.Task<ActionResult<Project>> GetProject(int id)
    {
        var project = await _context.Projects
            .Include(p => p.Team)
                .ThenInclude(t => t.Members)
            .Include(p => p.Tasks)
                .ThenInclude(t => t.AssignedTo)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (project == null)
        {
            return NotFound();
        }

        return project;
    }

    // GET: api/Projects/team/5
    [HttpGet("team/{teamId}")]
    public async System.Threading.Tasks.Task<ActionResult<IEnumerable<Project>>> GetProjectsByTeam(int teamId)
    {
        return await _context.Projects
            .Where(p => p.TeamId == teamId)
            .Include(p => p.Tasks)
            .ToListAsync();
    }

    // POST: api/Projects
    [Authorize(Roles = "Admin,Sous-Admin,Chef de Projet")]
    [HttpPost]
    public async System.Threading.Tasks.Task<ActionResult<Project>> PostProject(Project project)
    {
        project.CreatedAt = DateTime.UtcNow;
        _context.Projects.Add(project);
        await _context.SaveChangesAsync();

        await LogActivity("Création de projet", $"Le projet '{project.Name}' a été créé.", "Project", project.Id.ToString());

        return CreatedAtAction(nameof(GetProject), new { id = project.Id }, project);
    }

    // PUT: api/Projects/5
    [Authorize(Roles = "Admin,Sous-Admin,Chef de Projet")]
    [HttpPut("{id}")]
    public async System.Threading.Tasks.Task<IActionResult> PutProject(int id, Project project)
    {
        if (id != project.Id)
        {
            return BadRequest();
        }

        _context.Entry(project).State = EntityState.Modified;

        try
        {
            await _context.SaveChangesAsync();
            await LogActivity("Modification de projet", $"Le projet '{project.Name}' a été mis à jour.", "Project", project.Id.ToString());
        }
        catch (DbUpdateConcurrencyException)
        {
            if (!ProjectExists(id))
            {
                return NotFound();
            }
            throw;
        }

        return NoContent();
    }

    // DELETE: api/Projects/5
    [Authorize(Roles = "Admin,Sous-Admin")]
    [HttpDelete("{id}")]
    public async System.Threading.Tasks.Task<IActionResult> DeleteProject(int id)
    {
        var project = await _context.Projects.FindAsync(id);
        if (project == null)
        {
            return NotFound();
        }

        _context.Projects.Remove(project);
        await _context.SaveChangesAsync();

        await LogActivity("Suppression de projet", $"Le projet '{project.Name}' a été supprimé.", "Project", id.ToString());

        return NoContent();
    }

    private async System.Threading.Tasks.Task LogActivity(string action, string details, string? entityType = null, string? entityId = null)
    {
        try
        {
            var userEmail = User.FindFirstValue(ClaimTypes.Email);
            var userName = User.FindFirstValue(ClaimTypes.Name) ?? userEmail;

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

    private bool ProjectExists(int id)
    {
        return _context.Projects.Any(e => e.Id == id);
    }
}

