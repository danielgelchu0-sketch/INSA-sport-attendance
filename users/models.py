from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    ROLE_CHOICES = (
        ('student', 'Student'),
        ('sports_mentor', 'Sports Mentor'),
        ('admin', 'Admin'),
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='student')
    phone = models.CharField(max_length=20, blank=True, null=True)

    def is_student(self):
        return self.role == 'student'

    def is_mentor(self):
        return self.role == 'sports_mentor'


class StudentProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    registration_number = models.CharField(max_length=30, unique=True)
    group = models.CharField(max_length=50, blank=True)

    def __str__(self):
        return f"{self.user.get_full_name() or self.user.username} ({self.registration_number})"