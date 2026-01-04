using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectManager.Data;
using ProjectManager.Models;
using Microsoft.AspNetCore.Identity;
using System.Security.Claims;

namespace ProjectManager.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class TeamMembersController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;

    public TeamMembersController(ApplicationDbContext context, UserManager<ApplicationUser> userManager)
    {
        _context = context;
        _userManager = userManager;
    }

    [HttpGet]
    public async System.Threading.Tasks.Task<ActionResult<IEnumerable<TeamMember>>> GetTeamMembers()
    {
        var isAdmin = User.IsInRole("Admin") || User.IsInRole("Sous-Admin");
        var userEmail = User.FindFirstValue(ClaimTypes.Email)?.ToLower() ?? "";

        var query = _context.TeamMembers.Include(m => m.Team).AsQueryable();

        if (!isAdmin)
        {
            var userMember = await _context.TeamMembers.FirstOrDefaultAsync(m => m.Email.ToLower() == userEmail);
            if (userMember == null || userMember.TeamId == null)
            {
                return await query.Where(m => m.Email.ToLower() == userEmail).ToListAsync();
            }
            query = query.Where(m => m.TeamId == userMember.TeamId);
        }

        var list = await query.ToListAsync();

        // Populate UserId from Identity
        foreach (var member in list)
        {
            var appUser = await _userManager.FindByEmailAsync(member.Email);
            if (appUser != null)
            {
                member.UserId = appUser.Id;
            }
        }

        return list;
    }

    // GET: api/TeamMembers/5
    [HttpGet("{id}")]
    public async System.Threading.Tasks.Task<ActionResult<TeamMember>> GetTeamMember(int id)
    {
        var teamMember = await _context.TeamMembers
            .Include(m => m.Team)
            .Include(m => m.AssignedTasks)
            .FirstOrDefaultAsync(m => m.Id == id);

        if (teamMember == null)
        {
            return NotFound();
        }

        return teamMember;
    }

    // GET: api/TeamMembers/team/5
    [HttpGet("team/{teamId}")]
    public async System.Threading.Tasks.Task<ActionResult<IEnumerable<TeamMember>>> GetTeamMembersByTeam(int teamId)
    {
        return await _context.TeamMembers
            .Where(m => m.TeamId == teamId)
            .ToListAsync();
    }

    // POST: api/TeamMembers
    [Authorize(Roles = "Admin,Sous-Admin")]
    [HttpPost]
    public async System.Threading.Tasks.Task<ActionResult<TeamMember>> PostTeamMember(TeamMember teamMember)
    {
        // Check for duplicate email
        if (await _context.TeamMembers.AnyAsync(m => m.Email == teamMember.Email))
        {
            return BadRequest(new { message = "Un membre avec cet email existe déjà." });
        }

        _context.TeamMembers.Add(teamMember);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetTeamMember), new { id = teamMember.Id }, teamMember);
    }

    // PUT: api/TeamMembers/5
    [Authorize(Roles = "Admin,Sous-Admin")]
    [HttpPut("{id}")]
    public async System.Threading.Tasks.Task<IActionResult> PutTeamMember(int id, TeamMember teamMember)
    {
        if (id != teamMember.Id)
        {
            return BadRequest();
        }

        // Check if existing member exists and RBAC
        var existingMember = await _context.TeamMembers.AsNoTracking().FirstOrDefaultAsync(m => m.Id == id);
        if (existingMember == null) return NotFound();

        if (User.IsInRole("Sous-Admin"))
        {
            var targetUser = await _userManager.FindByEmailAsync(existingMember.Email);
            if (targetUser != null && await _userManager.IsInRoleAsync(targetUser, "Admin"))
            {
                return StatusCode(403, "Les Sous-Admins ne peuvent pas modifier les Administrateurs.");
            }
        }

        _context.Entry(teamMember).State = EntityState.Modified;

        try
        {
            await _context.SaveChangesAsync();
            
            // Sync name change to ApplicationUser (Identity)
            var appUser = await _userManager.FindByEmailAsync(teamMember.Email);
            if (appUser != null)
            {
                appUser.FullName = teamMember.Name;
                await _userManager.UpdateAsync(appUser);
            }
        }
        catch (DbUpdateConcurrencyException)
        {
            if (!TeamMemberExists(id))
            {
                return NotFound();
            }
            throw;
        }

        return NoContent();
    }

    // DELETE: api/TeamMembers/5
    [Authorize(Roles = "Admin,Sous-Admin")]
    [HttpDelete("{id}")]
    public async System.Threading.Tasks.Task<IActionResult> DeleteTeamMember(int id)
    {
        try
        {
            var teamMember = await _context.TeamMembers
                .Include(m => m.AssignedTasks) // Load tasks to unassign
                .Include(m => m.Comments)      // Load comments to delete
                .FirstOrDefaultAsync(m => m.Id == id);

            if (teamMember == null)
            {
                return NotFound(new { message = "Membre introuvable." });
            }

            // Check for duplicates (same email)
            // Use ToLower for safety
            var emailLower = teamMember.Email.ToLower();
            var memberCount = await _context.TeamMembers.CountAsync(m => m.Email.ToLower() == emailLower);
            bool isLastRecord = memberCount <= 1;

            if (isLastRecord)
            {
                // Safety check: Prevent admin from deleting themselves only if it's their last profile
                var currentUserEmail = User.FindFirstValue(ClaimTypes.Email);
                if (!string.IsNullOrEmpty(currentUserEmail) && teamMember.Email.ToLower() == currentUserEmail.ToLower())
                {
                    return BadRequest(new { message = "Vous ne pouvez pas supprimer votre propre compte profil unique d'administrateur." });
                }

                // Attempt to find and delete identity user(s)
                // Use Users.Where().ToList() to find ALL duplicates and delete them
                try
                {
                    var users = _userManager.Users.Where(u => u.Email == teamMember.Email).ToList();
                    foreach (var user in users)
                    {
                        // Enable aggressive deletion of duplicates
                        // But protect the main Admin
                        if (await _userManager.IsInRoleAsync(user, "Admin") && User.IsInRole("Sous-Admin"))
                        {
                            // Sous-admin cannot delete admin, skip this one
                             continue;
                        }
                        
                         // Only protect "admin@example.com" or the currently logged in user from self-deletion here?
                         // The outer check already handles the "last record" protection.
                         // But we should double check we don't delete the CURRENT ApplicationUser if it's the one logged in.
                        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
                         if (user.Id == currentUserId) 
                         {
                             // Do not delete the currently logged in user identity
                             continue; 
                         }

                        var result = await _userManager.DeleteAsync(user);
                        if (!result.Succeeded)
                        {
                            var errors = string.Join(", ", result.Errors.Select(e => e.Description));
                           try { System.IO.File.AppendAllText(@"C:\Users\aymen\OneDrive\Desktop\error_log.txt", DateTime.Now + " User delete failed: " + errors + "\n"); } catch { }
                        }
                    }
                }
                catch (Exception ex)
                {
                    // Log the error but continue to delete the TeamMember
                     try { System.IO.File.AppendAllText(@"C:\Users\aymen\OneDrive\Desktop\error_log.txt", DateTime.Now + " Identity Error: " + ex.Message + "\n"); } catch { }
                }
            }

            // Cleanup constraints
            // 1. Unassign tasks
            foreach (var task in teamMember.AssignedTasks)
            {
                task.AssignedToId = null;
            }

            // 2. Delete comments
            if (teamMember.Comments.Any())
            {
                _context.Comments.RemoveRange(teamMember.Comments);
            }

            // 3. Delete TeamMember record
            _context.TeamMembers.Remove(teamMember);
            await _context.SaveChangesAsync();

            return NoContent();
        }
        catch (DbUpdateException ex)
        {
            var msg = "Erreur BDD : " + (ex.InnerException?.Message ?? ex.Message);
            try { System.IO.File.AppendAllText(@"C:\Users\aymen\OneDrive\Desktop\error_log.txt", DateTime.Now + " " + msg + "\n" + ex.ToString() + "\n"); } catch { }
            return BadRequest(new { message = msg });
        }
        catch (Exception ex)
        {
            var msg = "Erreur inattendue : " + ex.Message;
            try { System.IO.File.AppendAllText(@"C:\Users\aymen\OneDrive\Desktop\error_log.txt", DateTime.Now + " " + msg + "\n" + ex.ToString() + "\n"); } catch { }
            return BadRequest(new { message = msg });
        }
    }

    private bool TeamMemberExists(int id)
    {
        return _context.TeamMembers.Any(e => e.Id == id);
    }
}
