import secrets
from django.db import models
from django.conf import settings
from django.utils import timezone


class SportsSession(models.Model):
    date = models.DateField(unique=True)
    start_time = models.TimeField(default="06:00")
    late_until = models.TimeField(default="06:15")
    qr_token = models.CharField(max_length=64, unique=True)
    qr_token_prev = models.CharField(max_length=64, blank=True, null=True)
    qr_token_updated_at = models.DateTimeField(auto_now_add=True)
    is_closed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Sports Session - {self.date}"


class AttendanceRecord(models.Model):
    STATUS_CHOICES = (
        ('present', 'Present'),
        ('late', 'Late'),
        ('absent', 'Absent'),
    )
    session = models.ForeignKey(SportsSession, on_delete=models.CASCADE, related_name='records')
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='attendances')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='absent')
    checked_in_at = models.DateTimeField(null=True, blank=True)
    marked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='marked_attendances'
    )
    note = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('session', 'student')

    def __str__(self):
        return f"{self.student.username} - {self.session.date} - {self.status}"