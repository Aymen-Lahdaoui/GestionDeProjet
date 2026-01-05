using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using ProjectManager.Models;
using TaskModel = ProjectManager.Models.Task;
using TaskStatusModel = ProjectManager.Models.TaskStatus;

namespace ProjectManager.Data;

public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<Project> Projects { get; set; }
    public DbSet<TaskModel> Tasks { get; set; }
    public DbSet<Team> Teams { get; set; }
    public DbSet<TeamMember> TeamMembers { get; set; }
    public DbSet<Comment> Comments { get; set; }
    public DbSet<ChatMessage> ChatMessages { get; set; }
    public DbSet<ActivityLog> ActivityLogs { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Configure relationships
        modelBuilder.Entity<Project>()
            .HasOne(p => p.Team)
            .WithMany(t => t.Projects)
            .HasForeignKey(p => p.TeamId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<TaskModel>()
            .HasOne(t => t.Project)
            .WithMany(p => p.Tasks)
            .HasForeignKey(t => t.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<TaskModel>()
            .HasOne(t => t.AssignedTo)
            .WithMany(m => m.AssignedTasks)
            .HasForeignKey(t => t.AssignedToId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<TeamMember>()
            .HasOne(m => m.Team)
            .WithMany(t => t.Members)
            .HasForeignKey(m => m.TeamId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Comment>()
            .HasOne(c => c.Task)
            .WithMany(t => t.Comments)
            .HasForeignKey(c => c.TaskId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Comment>()
            .HasOne(c => c.Author)
            .WithMany(m => m.Comments)
            .HasForeignKey(c => c.AuthorId)
            .OnDelete(DeleteBehavior.Restrict);

        // Seed initial data
        SeedData(modelBuilder);
    }

    private void SeedData(ModelBuilder modelBuilder)
    {
        var team1 = new Team { Id = 1, Name = "Équipe Développement", Description = "Équipe principale de développement", CreatedAt = DateTime.UtcNow };
        var team2 = new Team { Id = 2, Name = "Équipe Design", Description = "Équipe de design UI/UX", CreatedAt = DateTime.UtcNow };

        modelBuilder.Entity<Team>().HasData(team1, team2);

        var member1 = new TeamMember { Id = 1, Name = "Jean Dupont", Email = "jean.dupont@example.com", Role = "Développeur Senior", TeamId = 1 };
        var member2 = new TeamMember { Id = 2, Name = "Marie Martin", Email = "marie.martin@example.com", Role = "Développeuse", TeamId = 1 };
        var member3 = new TeamMember { Id = 3, Name = "Pierre Durand", Email = "pierre.durand@example.com", Role = "Designer", TeamId = 2 };

        modelBuilder.Entity<TeamMember>().HasData(member1, member2, member3);

        var project1 = new Project
        {
            Id = 1,
            Name = "Application Web",
            Description = "Développement d'une nouvelle application web",
            CreatedAt = DateTime.UtcNow,
            Deadline = DateTime.UtcNow.AddMonths(3),
            Status = ProjectStatus.InProgress,
            TeamId = 1
        };

        modelBuilder.Entity<Project>().HasData(project1);

        var task1 = new TaskModel
        {
            Id = 1,
            Title = "Créer la structure du projet",
            Description = "Mettre en place l'architecture de base",
            CreatedAt = DateTime.UtcNow,
            Deadline = DateTime.UtcNow.AddDays(7),
            Priority = TaskPriority.High,
            Status = TaskStatusModel.InProgress,
            ProjectId = 1,
            AssignedToId = 1
        };

        var task2 = new TaskModel
        {
            Id = 2,
            Title = "Développer l'interface utilisateur",
            Description = "Créer les composants UI",
            CreatedAt = DateTime.UtcNow,
            Deadline = DateTime.UtcNow.AddDays(14),
            Priority = TaskPriority.Medium,
            Status = TaskStatusModel.ToDo,
            ProjectId = 1,
            AssignedToId = 2
        };

        modelBuilder.Entity<TaskModel>().HasData(task1, task2);
    }
}

