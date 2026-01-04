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

        return NoContent();
    }

    private bool TeamExists(int id)
    {
        return _context.Teams.Any(e => e.Id == id);
    }
}
