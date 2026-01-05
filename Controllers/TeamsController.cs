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
public class TeamsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public TeamsController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async System.Threading.Tasks.Task<ActionResult<IEnumerable<Team>>> GetTeams()
    {
        var canSeeAll = User.Identity?.IsAuthenticated == true && (User.IsInRole("Admin") || User.IsInRole("Sous-Admin"));
        var userEmail = User.FindFirstValue(ClaimTypes.Email)?.ToLower() ?? "";

        var query = _context.Teams
            .Include(t => t.Members)
            .Include(t => t.Projects)
            .AsQueryable();

        if (!canSeeAll)
        {
            var userMember = await _context.TeamMembers.FirstOrDefaultAsync(m => m.Email.ToLower() == userEmail);
            if (userMember == null || userMember.TeamId == null)
            {
                return new List<Team>();
            }
            query = query.Where(t => t.Id == userMember.TeamId);
        }

        return await query.ToListAsync();
    }

    // GET: api/Teams/5
    [HttpGet("{id}")]
    public async System.Threading.Tasks.Task<ActionResult<Team>> GetTeam(int id)
    {
        var team = await _context.Teams
            .Include(t => t.Members)
            .Include(t => t.Projects)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (team == null)
        {
            return NotFound();
        }

        return team;
    }

    // POST: api/Teams
    [Authorize(Roles = "Admin,Sous-Admin")]
    [HttpPost]
    public async System.Threading.Tasks.Task<ActionResult<Team>> PostTeam(Team team)
    {
        team.CreatedAt = DateTime.UtcNow;
        _context.Teams.Add(team);
        await _context.SaveChangesAsync();

        // Activity Logging
        await LogActivity("Création d'Équipe", $"L'équipe '{team.Name}' a été créée.", "Team", team.Id.ToString());

        return CreatedAtAction(nameof(GetTeam), new { id = team.Id }, team);
    }

    // PUT: api/Teams/5
    [Authorize(Roles = "Admin,Sous-Admin")]
    [HttpPut("{id}")]
    public async System.Threading.Tasks.Task<IActionResult> PutTeam(int id, Team team)
    {
        if (id != team.Id)
        {
            return BadRequest();
        }

        _context.Entry(team).State = EntityState.Modified;

        try
        {
            await _context.SaveChangesAsync();
            // Activity Logging
            await LogActivity("Mise à jour d'Équipe", $"L'équipe '{team.Name}' a été mise à jour.", "Team", team.Id.ToString());
        }
        catch (DbUpdateConcurrencyException)
        {
            if (!TeamExists(id))
            {
                return NotFound();
            }
            throw;
        }

        return NoContent();
    }

    // DELETE: api/Teams/5
    [Authorize(Roles = "Admin,Sous-Admin")]
    [HttpDelete("{id}")]
    public async System.Threading.Tasks.Task<IActionResult> DeleteTeam(int id)
    {
        var team = await _context.Teams.FindAsync(id);
        if (team == null)
        {
            return NotFound();
        }

        _context.Teams.Remove(team);
        await _context.SaveChangesAsync();

        // Activity Logging
        await LogActivity("Suppression d'Équipe", $"L'équipe '{team.Name}' a été supprimée.", "Team", id.ToString());

        return NoContent();
    }

    private async System.Threading.Tasks.Task LogActivity(string action, string details, string entityType = null, string entityId = null)
    {
        try
        {
            var userEmail = User.FindFirstValue(ClaimTypes.Email) ?? "system@projet.com";
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
            Console.WriteLine($"Logging Error: {ex.Message}");
        }
    }

    private bool TeamExists(int id)
    {
        return _context.Teams.Any(e => e.Id == id);
    }
}
