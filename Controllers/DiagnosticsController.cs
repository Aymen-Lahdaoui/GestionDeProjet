using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectManager.Data;
using System.Security.Claims;

namespace ProjectManager.Controllers;

[Authorize(Roles = "Admin,Sous-Admin")]
[ApiController]
[Route("api/[controller]")]
public class DiagnosticsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public DiagnosticsController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet("team-assignments")]
    public async Task<ActionResult<object>> GetTeamAssignments()
    {
        var users = await _context.Users.ToListAsync();
        var teamMembers = await _context.TeamMembers.Include(tm => tm.Team).ToListAsync();
        var teams = await _context.Teams.ToListAsync();
        var projects = await _context.Projects.Include(p => p.Team).ToListAsync();

        var userRoles = new List<object>();
        foreach (var user in users)
        {
            var roles = await _context.UserRoles
                .Where(ur => ur.UserId == user.Id)
                .Join(_context.Roles, ur => ur.RoleId, r => r.Id, (ur, r) => r.Name)
                .ToListAsync();

            var teamMember = teamMembers.FirstOrDefault(tm => 
                tm.Email.ToLower() == user.Email.ToLower());

            userRoles.Add(new
            {
                Email = user.Email,
                UserName = user.UserName,
                Roles = roles,
                HasTeamMember = teamMember != null,
                TeamMemberId = teamMember?.Id,
                TeamMemberName = teamMember?.Name,
                TeamId = teamMember?.TeamId,
                TeamName = teamMember?.Team?.Name,
                TeamRole = teamMember?.Role
            });
        }

        var projectInfo = projects.Select(p => new
        {
            ProjectId = p.Id,
            ProjectName = p.Name,
            TeamId = p.TeamId,
            TeamName = p.Team?.Name
        }).ToList();

        return Ok(new
        {
            Users = userRoles,
            Teams = teams.Select(t => new { t.Id, t.Name }),
            Projects = projectInfo,
            Summary = new
            {
                TotalUsers = users.Count,
                UsersWithTeamMember = teamMembers.Count,
                UsersWithoutTeamMember = users.Count - teamMembers.Count,
                TotalTeams = teams.Count,
                TotalProjects = projects.Count
            }
        });
    }

    [HttpGet("check-user/{email}")]
    public async Task<ActionResult<object>> CheckUser(string email)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email.ToLower());
        if (user == null)
        {
            return NotFound(new { Message = "User not found" });
        }

        var roles = await _context.UserRoles
            .Where(ur => ur.UserId == user.Id)
            .Join(_context.Roles, ur => ur.RoleId, r => r.Id, (ur, r) => r.Name)
            .ToListAsync();

        var teamMember = await _context.TeamMembers
            .Include(tm => tm.Team)
            .FirstOrDefaultAsync(tm => tm.Email.ToLower() == email.ToLower());

        List<object> visibleProjects = new();
        if (teamMember?.TeamId != null)
        {
            visibleProjects = await _context.Projects
                .Where(p => p.TeamId == teamMember.TeamId)
                .Include(p => p.Team)
                .Select(p => new
                {
                    p.Id,
                    p.Name,
                    p.TeamId,
                    TeamName = p.Team != null ? p.Team.Name : null
                })
                .ToListAsync<object>();
        }

        return Ok(new
        {
            User = new
            {
                user.Email,
                user.UserName,
                Roles = roles
            },
            TeamMember = teamMember != null ? new
            {
                teamMember.Id,
                teamMember.Name,
                teamMember.Email,
                teamMember.TeamId,
                TeamName = teamMember.Team?.Name,
                teamMember.Role
            } : null,
            VisibleProjects = visibleProjects,
            Issues = new List<string>
            {
                teamMember == null ? "⚠️ No TeamMember record found" : null,
                teamMember?.TeamId == null ? "⚠️ TeamMember has no TeamId assigned" : null,
                teamMember != null && teamMember.Email.ToLower() != email.ToLower() ? "⚠️ Email case mismatch" : null
            }.Where(i => i != null).ToList()
        });
    }
}
