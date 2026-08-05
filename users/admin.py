from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, StudentProfile

class CustomUserAdmin(UserAdmin):
    # Display role in the user list view
    list_display = ('username', 'email', 'role', 'is_staff')
    
    # Add custom fields to the edit user form view
    fieldsets = UserAdmin.fieldsets + (
        ('Custom Profile Info', {'fields': ('role', 'phone')}),
    )
    
    # Add custom fields to the create user form view
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Custom Profile Info', {'fields': ('role', 'phone')}),
    )

admin.site.register(User, CustomUserAdmin)
admin.site.register(StudentProfile)