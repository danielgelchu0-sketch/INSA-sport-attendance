from django.contrib import admin
from .models import SportsSession, AttendanceRecord

admin.site.register(SportsSession)
admin.site.register(AttendanceRecord)