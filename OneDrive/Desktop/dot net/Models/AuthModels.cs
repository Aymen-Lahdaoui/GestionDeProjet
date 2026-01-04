namespace ProjectManager.Models;

public record RegisterModel(string UserName, string Email, string Password, string? FullName);
public record LoginModel(string UserName, string Password);
public record ProfileUpdateModel(string? FullName, string? Email, string? Bio, string? Role, string? Phone);
public record ChangePasswordModel(string CurrentPassword, string NewPassword, string ConfirmPassword);
public record TwoFactorStatusModel(bool IsEnabled, bool HasAuthenticator);
public record TwoFactorSetupModel(string SharedKey, string AuthenticatorUri);
public record VerifyTwoFactorModel(string Code);
public record TwoFactorLoginModel(string UserName, string Password, string Code);
public record UpdateUserRoleModel(string Email, string NewRole);
