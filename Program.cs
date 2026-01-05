using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using ProjectManager.Data;
using ProjectManager.Models;
using System.Text;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddSignalR();
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
        options.JsonSerializerOptions.WriteIndented = true;
    });

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// Identity
builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
{
    options.Password.RequireDigit = false;
    options.Password.RequiredLength = 6;
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequireUppercase = false;
    options.User.RequireUniqueEmail = true;
})
    .AddEntityFrameworkStores<ApplicationDbContext>()
    .AddDefaultTokenProviders();

// JWT configuration
var jwtSection = builder.Configuration.GetSection("Jwt");
var jwtKey = jwtSection.GetValue<string>("Key") ?? "ChangeThisSecretKeyToSomethingSecure";
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtSection.GetValue<string>("Issuer") ?? "ProjectManager",
            ValidAudience = jwtSection.GetValue<string>("Audience") ?? "ProjectManager",
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
        
        // We have to hook the OnMessageReceived event in order to
        // allow the JWT authentication handler to read the access
        // token from the query string when a WebSocket or 
        // Server-Sent Events request comes in.
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];

                // If the request is for our hub...
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) &&
                    (path.StartsWithSegments("/chatHub")))
                {
                    // Read the token out of the query string
                    context.Token = accessToken;
                }
                return System.Threading.Tasks.Task.CompletedTask;
            }
        };
    });

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowAll");

app.UseStaticFiles();

app.UseRouting();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<ProjectManager.Hubs.ChatHub>("/chatHub");

app.MapFallbackToFile("index.html");

// Ensure database is created
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    
    // For SQL Server, EnsureCreated is simple for dev but migrations are better. 
    // We'll keep EnsureCreated for simplicity as requested, but beware of migration conflicts if Mixing.
    context.Database.EnsureCreated();

    // Seed default admin user and role only if Identity tables exist
    var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
    var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();

    bool identityTablesExist = false;
    try
    {
        var conn = context.Database.GetDbConnection();
        conn.Open();
        using (var cmd = conn.CreateCommand())
        {
            // SQL Server syntax for checking table existence
            cmd.CommandText = "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'AspNetRoles';";
            var result = cmd.ExecuteScalar();
            identityTablesExist = result != null;

            // Fix for missing ChatMessages table
            cmd.CommandText = "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ChatMessages';";
            var chatTableExists = cmd.ExecuteScalar() != null;
            if (!chatTableExists)
            {
                Console.WriteLine("[Init] Creating missing ChatMessages table...");
                cmd.CommandText = @"
                    CREATE TABLE [ChatMessages] (
                        [Id] int NOT NULL IDENTITY,
                        [SenderId] nvarchar(max) NOT NULL,
                        [SenderName] nvarchar(max) NOT NULL,
                        [Content] nvarchar(max) NOT NULL,
                        [SentAt] datetime2 NOT NULL,
                        [Type] int NOT NULL,
                        [ReceiverId] nvarchar(max) NULL,
                        [ProjectId] int NULL,
                        CONSTRAINT [PK_ChatMessages] PRIMARY KEY ([Id]),
                        CONSTRAINT [FK_ChatMessages_Projects_ProjectId] FOREIGN KEY ([ProjectId]) REFERENCES [Projects] ([Id]) ON DELETE NO ACTION
                    );
                    CREATE INDEX [IX_ChatMessages_ProjectId] ON [ChatMessages] ([ProjectId]);
                ";
                cmd.ExecuteNonQuery();
                Console.WriteLine("[Init] ChatMessages table created successfully.");
            }

            // Fix for missing ActivityLogs table
            cmd.CommandText = "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ActivityLogs';";
            var logsTableExists = cmd.ExecuteScalar() != null;
            if (!logsTableExists)
            {
                Console.WriteLine("[Init] Creating missing ActivityLogs table...");
                cmd.CommandText = @"
                    CREATE TABLE [ActivityLogs] (
                        [Id] int NOT NULL IDENTITY,
                        [UserEmail] nvarchar(max) NULL,
                        [UserName] nvarchar(max) NULL,
                        [Action] nvarchar(max) NOT NULL,
                        [Details] nvarchar(max) NULL,
                        [Timestamp] datetime2 NOT NULL,
                        [EntityType] nvarchar(max) NULL,
                        [EntityId] nvarchar(max) NULL,
                        CONSTRAINT [PK_ActivityLogs] PRIMARY KEY ([Id])
                    );
                ";
                cmd.ExecuteNonQuery();
                Console.WriteLine("[Init] ActivityLogs table created successfully.");
            }
        }
        conn.Close();
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Error checking tables: {ex.Message}");
        identityTablesExist = false;
    }

    if (identityTablesExist)
    {
        var roles = new[] { "Admin", "Sous-Admin", "Chef de Projet", "User" };
        foreach (var role in roles)
        {
            if (!roleManager.RoleExistsAsync(role).Result)
            {
                roleManager.CreateAsync(new IdentityRole(role)).Wait();
            }
        }

        var adminEmail = "admin@example.com";
        var adminUser = userManager.FindByEmailAsync(adminEmail).Result;
        
        if (adminUser == null)
        {
            adminUser = new ApplicationUser 
            { 
                UserName = "admin", 
                Email = adminEmail, 
                EmailConfirmed = true, 
                FullName = "Administrator" 
            };
            var createResult = userManager.CreateAsync(adminUser, "Admin123!").Result;
            if (createResult.Succeeded)
            {
                userManager.AddToRoleAsync(adminUser, "Admin").Wait();
            }
        }
        // Ensure existing admin user has the Admin role
        var isInRole = userManager.IsInRoleAsync(adminUser, "Admin").Result;
        if (!isInRole)
        {
            userManager.AddToRoleAsync(adminUser, "Admin").Wait();
        }

        // Force disable 2FA for admin (recovery)
        if (adminUser.TwoFactorEnabled)
        {
            adminUser.TwoFactorEnabled = false;
            userManager.UpdateAsync(adminUser).Wait();
            Console.WriteLine("2FA disabled for admin.");
        }

        // --- ENHANCED: Synchronize all Users to TeamMembers with Team Assignment ---
        Console.WriteLine("[Seeding] Starting TeamMember synchronization...");
        
        // Ensure default teams exist
        var devTeam = context.Teams.FirstOrDefault(t => t.Name.Contains("Développement") || t.Name.Contains("Dev"));
        var designTeam = context.Teams.FirstOrDefault(t => t.Name.Contains("Design"));
        
        if (devTeam == null)
        {
            devTeam = new Team { Name = "Équipe Développement", Description = "Équipe de développement" };
            context.Teams.Add(devTeam);
            context.SaveChanges();
            Console.WriteLine("[Seeding] Created default Développement team");
        }
        
        if (designTeam == null)
        {
            designTeam = new Team { Name = "Équipe Design", Description = "Équipe de design" };
            context.Teams.Add(designTeam);
            context.SaveChanges();
            Console.WriteLine("[Seeding] Created default Design team");
        }
        
        var allUsers = userManager.Users.ToList();
        foreach (var user in allUsers)
        {
            var existingMember = context.TeamMembers.FirstOrDefault(m => m.Email.ToLower() == user.Email.ToLower());
            if (existingMember == null)
            {
                // Determine team based on user role or email
                int? assignedTeamId = null;
                string teamRole = "Collaborateur";
                
                var userRoles = userManager.GetRolesAsync(user).Result;
                
                // Assign team based on role or email pattern
                if (userRoles.Contains("Admin") || userRoles.Contains("Sous-Admin"))
                {
                    // Admins don't need a team (they see all projects)
                    assignedTeamId = null;
                    teamRole = "Administrateur";
                }
                else if (user.Email.ToLower().Contains("omar") || user.Email.ToLower().Contains("dev"))
                {
                    // Users with "omar" or "dev" in email go to Dev team
                    assignedTeamId = devTeam.Id;
                    teamRole = userRoles.Contains("Chef de Projet") ? "Chef de groupe" : "Collaborateur";
                }
                else if (user.Email.ToLower().Contains("design"))
                {
                    // Users with "design" in email go to Design team
                    assignedTeamId = designTeam.Id;
                    teamRole = userRoles.Contains("Chef de Projet") ? "Chef de groupe" : "Collaborateur";
                }
                else
                {
                    // Default: assign to Dev team for non-admin users
                    assignedTeamId = devTeam.Id;
                }
                
                var newMember = new TeamMember
                {
                    Name = user.FullName ?? user.UserName ?? "Utilisateur",
                    Email = user.Email ?? "",
                    Role = teamRole,
                    TeamId = assignedTeamId
                };
                context.TeamMembers.Add(newMember);
                context.SaveChanges();
                Console.WriteLine($"[Seeding] Synchronized user to member: {user.Email} -> Team: {assignedTeamId} ({teamRole})");
            }
            else if (existingMember.TeamId == null && !userManager.IsInRoleAsync(user, "Admin").Result && !userManager.IsInRoleAsync(user, "Sous-Admin").Result)
            {
                // Fix existing members with null TeamId (except admins)
                if (user.Email.ToLower().Contains("omar") || user.Email.ToLower().Contains("dev"))
                {
                    existingMember.TeamId = devTeam.Id;
                }
                else if (user.Email.ToLower().Contains("design"))
                {
                    existingMember.TeamId = designTeam.Id;
                }
                else
                {
                    existingMember.TeamId = devTeam.Id;
                }
                context.SaveChanges();
                Console.WriteLine($"[Seeding] Fixed TeamId for existing member: {user.Email} -> Team: {existingMember.TeamId}");
            }
        }
        Console.WriteLine("[Seeding] TeamMember synchronization complete.");
    }
    else
    {
        Console.WriteLine("Identity tables not present yet. Ensure EF migrations are applied if using migrations, or EnsureCreated has run successfully.");
    }
}

app.Run();


