from rest_framework import serializers
from .models import SportsSession, AttendanceRecord
from django.contrib.auth import get_user_model

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'role']

class SportsSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = SportsSession
        fields = ['id', 'date', 'start_time', 'late_until', 'is_closed']

class AttendanceRecordSerializer(serializers.ModelSerializer):
    student = UserSerializer(read_only=True)

    class Meta:
        model = AttendanceRecord
        fields = ['id', 'session', 'student', 'status', 'checked_in_at', 'note']

class DashboardRecordSerializer(serializers.ModelSerializer):
    student_id = serializers.IntegerField(source='student.id')
    username = serializers.CharField(source='student.username')
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = AttendanceRecord
        fields = ['id', 'student_id', 'username', 'full_name', 'status', 'checked_in_at', 'note']

    def get_full_name(self, obj):
        return obj.student.get_full_name() or obj.student.username