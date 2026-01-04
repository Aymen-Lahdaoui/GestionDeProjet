using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using ProjectManager.Models;
using ProjectManager.Data;

namespace ProjectManager.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly IConfiguration _configuration;
    private readonly IWebHostEnvironment _env;
    private readonly ApplicationDbContext _context;
    private readonly RoleManager<IdentityRole> _roleManager;

    public AuthController(UserManager<ApplicationUser> userManager, SignInManager<ApplicationUser> signInManager, IConfiguration configuration, IWebHostEnvironment env, ApplicationDbContext context, RoleManager<IdentityRole> roleManager)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _configuration = configuration;
        _env = env;
        _context = context;
        _roleManager = roleManager;
    }

    [HttpPost("register")]
    public async System.Threading.Tasks.Task<IActionResult> Register([FromBody] RegisterModel model)
    {
        var user = new ApplicationUser { UserName = model.UserName, Email = model.Email, FullName = model.FullName };
        var result = await _userManager.CreateAsync(user, model.Password);
        if (!result.Succeeded) return BadRequest(result.Errors);
        
        await _userManager.AddToRoleAsync(user, "User");

        // Check if TeamMember already exists (to avoid duplicates)
        if (_context.TeamMembers.Any(m => m.Email == model.Email))
        {
            // Already exists, just return Ok
             return Ok(new { message = "Compte créé et lié au membre existant." });
        }

        // Automatically create a TeamMember record for the new user
        var teamMember = new TeamMember
        {
            Name = model.FullName,
            Email = model.Email,
            Role = "Collaborateur",
            TeamId = null // Assigned later by Admin
        };
        _context.TeamMembers.Add(teamMember);
        await _context.SaveChangesAsync();

        return Ok();
    }

    [HttpPost("login")]
    public async System.Threading.Tasks.Task<IActionResult> Login([FromBody] LoginModel model)
    {
        // Accept either username or email for login
        var user = await _userManager.FindByNameAsync(model.UserName);
        if (user == null)
        {
            user = await _userManager.FindByEmailAsync(model.UserName);
        }
        if (user == null) return Unauthorized();

        var valid = await _userManager.CheckPasswordAsync(user, model.Password);
        if (!valid) return Unauthorized();

        // Check if 2FA is enabled
        if (await _userManager.GetTwoFactorEnabledAsync(user))
        {
            return Ok(new { requiresTwoFactor = true, userName = user.UserName });
        }

        return await GenerateTokenResponse(user);
    }

    [HttpPost("2fa-login")]
    public async System.Threading.Tasks.Task<IActionResult> LoginTwoFactor([FromBody] TwoFactorLoginModel model)
    {
        var user = await _userManager.FindByNameAsync(model.UserName);
        if (user == null) return Unauthorized();

        var validPassword = await _userManager.CheckPasswordAsync(user, model.Password);
        if (!validPassword) return Unauthorized();

        var validCode = await _userManager.VerifyTwoFactorTokenAsync(user, _userManager.Options.Tokens.AuthenticatorTokenProvider, model.Code);
        if (!validCode) return BadRequest(new { message = "Code de vérification invalide." });

        return await GenerateTokenResponse(user);
    }

    private async System.Threading.Tasks.Task<IActionResult> GenerateTokenResponse(ApplicationUser user)
    {
        var jwtSection = _configuration.GetSection("Jwt");
        var key = jwtSection.GetValue<string>("Key") ?? "ChangeThisSecretKeyToSomethingSecure";
        var issuer = jwtSection.GetValue<string>("Issuer") ?? "ProjectManager";
        var audience = jwtSection.GetValue<string>("Audience") ?? "ProjectManager";

        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id),
            new Claim(ClaimTypes.Email, user.Email ?? ""),
            new Claim("unique_name", user.UserName ?? ""),
            new Claim(ClaimTypes.Name, user.UserName ?? "")
        };

        var userRoles = await _userManager.GetRolesAsync(user);
        foreach (var role in userRoles)
        {
            claims.Add(new Claim(ClaimTypes.Role, role));
        }

        var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key));
        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(12),
            signingCredentials: new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256)
        );

        var tokenString = new JwtSecurityTokenHandler().WriteToken(token);
        var userRole = userRoles.FirstOrDefault() ?? "User";

        var teamMember = _context.TeamMembers.FirstOrDefault(m => m.Email == user.Email);

        return Ok(new { 
            token = tokenString, 
            expires = token.ValidTo,
            user = new {
                userName = user.UserName,
                email = user.Email,
                fullName = user.FullName,
                role = userRole,
                id = user.Id,
                teamMemberId = teamMember?.Id
            }
        });
    }

    // Debug endpoint - only available in Development environment
    [HttpGet("debug/users")]
    public IActionResult ListUsers()
    {
        if (!_env.IsDevelopment()) return Forbid();

        var users = _userManager.Users.Select(u => new { u.Id, u.UserName, u.Email, u.FullName, u.EmailConfirmed }).ToList();
        return Ok(users);
    }

    [Authorize]
    [HttpPut("profile")]
    public async System.Threading.Tasks.Task<IActionResult> UpdateProfile([FromBody] ProfileUpdateModel model)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return Unauthorized();

        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) return NotFound();

        if (!string.IsNullOrWhiteSpace(model.FullName))
            user.FullName = model.FullName;

        if (!string.IsNullOrWhiteSpace(model.Email) && model.Email != user.Email)
        {
            user.Email = model.Email;
            user.UserName = model.Email;
        }

        user.Bio = model.Bio;
        user.Role = model.Role;
        if (!string.IsNullOrEmpty(model.Phone))
        {
            if (!System.Text.RegularExpressions.Regex.IsMatch(model.Phone, @"^(\+212|0)([ \-_/]*)(\d[ \-_/]*){9}$"))
            {
                 return BadRequest(new { message = "Numéro de téléphone invalide (Format Marocain requis)." });
            }
        }
        user.Phone = model.Phone;

        var result = await _userManager.UpdateAsync(user);
        if (!result.Succeeded) return BadRequest(result.Errors);

        return Ok(new
        {
            userName = user.UserName,
            email = user.Email,
            fullName = user.FullName,
            bio = user.Bio,
            role = user.Role,
            phone = user.Phone
        });
    }

    [Authorize]
    [HttpPost("change-password")]
    public async System.Threading.Tasks.Task<IActionResult> ChangePassword([FromBody] ChangePasswordModel model)
    {
        if (model.NewPassword != model.ConfirmPassword)
            return BadRequest(new { message = "Le nouveau mot de passe et sa confirmation ne correspondent pas." });

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return Unauthorized();

        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) return NotFound();

        var result = await _userManager.ChangePasswordAsync(user, model.CurrentPassword, model.NewPassword);
        if (!result.Succeeded) return BadRequest(result.Errors);

        return Ok(new { message = "Mot de passe mis à jour avec succès !" });
    }

    [Authorize]
    [HttpGet("2fa-status")]
    public async System.Threading.Tasks.Task<IActionResult> GetTwoFactorStatus()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var user = await _userManager.FindByIdAsync(userId!);
        return Ok(new TwoFactorStatusModel(user!.TwoFactorEnabled, !string.IsNullOrEmpty(await _userManager.GetAuthenticatorKeyAsync(user))));
    }

    [Authorize]
    [HttpPost("2fa-setup")]
    public async System.Threading.Tasks.Task<IActionResult> SetupTwoFactor()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var user = await _userManager.FindByIdAsync(userId!);

        var key = await _userManager.GetAuthenticatorKeyAsync(user!);
        if (string.IsNullOrEmpty(key))
        {
            await _userManager.ResetAuthenticatorKeyAsync(user!);
            key = await _userManager.GetAuthenticatorKeyAsync(user!);
        }

        var authenticatorUri = $"otpauth://totp/ProjectManager:{user!.Email}?secret={key}&issuer=ProjectManager";
        return Ok(new TwoFactorSetupModel(key!, authenticatorUri));
    }

    [Authorize]
    [HttpPost("2fa-verify")]
    public async System.Threading.Tasks.Task<IActionResult> VerifyTwoFactor([FromBody] VerifyTwoFactorModel model)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var user = await _userManager.FindByIdAsync(userId!);

        var valid = await _userManager.VerifyTwoFactorTokenAsync(user!, _userManager.Options.Tokens.AuthenticatorTokenProvider, model.Code);
        if (!valid) return BadRequest(new { message = "Code de vérification invalide." });

        await _userManager.SetTwoFactorEnabledAsync(user!, true);
        return Ok(new { message = "Double authentification activée avec succès !" });
    }

    [Authorize]
    [HttpPost("2fa-disable")]
    public async System.Threading.Tasks.Task<IActionResult> DisableTwoFactor()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var user = await _userManager.FindByIdAsync(userId!);

        await _userManager.SetTwoFactorEnabledAsync(user!, false);
        await _userManager.ResetAuthenticatorKeyAsync(user!);

        return Ok(new { message = "Double authentification désactivée." });
    }

    [Authorize(Roles = "Admin,Sous-Admin")]
    [HttpPut("UpdateUserRole")]
    public async System.Threading.Tasks.Task<IActionResult> UpdateUserRole([FromBody] UpdateUserRoleModel model)
    {
        // Use Users.Where to handle potential duplicates
        var users = _userManager.Users.Where(u => u.Email == model.Email).ToList();
        
        if (!users.Any())
        {
            return NotFound(new { message = "Utilisateur non trouvé." });
        }

        foreach (var user in users)
        {
            // Prevent changing admin role
            if (await _userManager.IsInRoleAsync(user, "Admin") && model.NewRole != "Admin")
            {
                // Verify if it is really the main admin before blocking? 
                // For safety, we skip this specific user but continue with others if any
                continue; 
            }

            // Ensure the role exists
            if (!await _roleManager.RoleExistsAsync(model.NewRole))
            {
                await _roleManager.CreateAsync(new IdentityRole(model.NewRole));
            }

            // Remove from all current roles
            var currentRoles = await _userManager.GetRolesAsync(user);
            await _userManager.RemoveFromRolesAsync(user, currentRoles);

            // Add to new role
            var result = await _userManager.AddToRoleAsync(user, model.NewRole);
            if (!result.Succeeded)
            {
                return BadRequest(new { message = "Échec de l'attribution du rôle.", errors = result.Errors });
            }
        }

        return Ok(new { message = $"Rôle mis à jour vers {model.NewRole}" });
    }

    [Authorize(Roles = "Admin,Sous-Admin")]
    [HttpGet("GetUserRole/{email}")]
    public async System.Threading.Tasks.Task<IActionResult> GetUserRole(string email)
    {
        // Use Users.FirstOrDefault to avoid exception on duplicates
        var user = _userManager.Users.FirstOrDefault(u => u.Email == email);
        if (user == null)
        {
            return NotFound(new { message = "Utilisateur non trouvé." });
        }

        var roles = await _userManager.GetRolesAsync(user);
        return Ok(new { role = roles.FirstOrDefault() ?? "User" });
    }
}

