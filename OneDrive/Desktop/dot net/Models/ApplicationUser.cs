using Microsoft.AspNetCore.Identity;

namespace ProjectManager.Models;

public class ApplicationUser : IdentityUser
{
    public string? FullName { get; set; }
    public string? Bio { get; set; }
    public string? Role { get; set; }
    public string? Phone { get; set; }
}
