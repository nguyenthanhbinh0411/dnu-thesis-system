using Microsoft.EntityFrameworkCore;
using ThesisManagement.Api.Services;

namespace ThesisManagement.Api.Application.Command.Users
{
    public interface IDeleteUserCommand
    {
        Task<UserCommandResult<object?>> ExecuteAsync(int id);
    }

    public class DeleteUserCommand : IDeleteUserCommand
    {
        private readonly IUnitOfWork _uow;

        public DeleteUserCommand(IUnitOfWork uow)
        {
            _uow = uow;
        }

        public async Task<UserCommandResult<object?>> ExecuteAsync(int id)
        {
            var user = await _uow.Users.GetByIdAsync(id);
            if (user == null)
                return UserCommandResult<object?>.Failed("User not found", 404);

            // Delete associated profiles based on role
            if (user.Role == "Student")
            {
                var studentProfile = await _uow.StudentProfiles.Query()
                    .FirstOrDefaultAsync(p => p.UserID == id);
                if (studentProfile != null)
                {
                    _uow.StudentProfiles.Remove(studentProfile);
                }
            }
            else if (user.Role == "Lecturer")
            {
                var lecturerProfile = await _uow.LecturerProfiles.Query()
                    .FirstOrDefaultAsync(p => p.UserID == id);
                if (lecturerProfile != null)
                {
                    _uow.LecturerProfiles.Remove(lecturerProfile);
                }
            }

            _uow.Users.Remove(user);
            await _uow.SaveChangesAsync();

            return UserCommandResult<object?>.Succeeded(null);
        }
    }
}
