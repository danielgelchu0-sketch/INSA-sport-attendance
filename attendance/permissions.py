from rest_framework.permissions import BasePermission

class IsMentor(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'sports_mentor')