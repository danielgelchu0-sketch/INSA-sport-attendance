from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from attendance.models import AttendanceRecord
from attendance.utils import get_or_create_today_session

User = get_user_model()

class Command(BaseCommand):
    help = "Marks all unrecorded students as absent and closes today's session."

    def handle(self, *args, **options):
        session = get_or_create_today_session()
        students = User.objects.filter(role='student')
        marked_ids = set(AttendanceRecord.objects.filter(session=session).values_list('student_id', flat=True))

        created = 0
        for student in students:
            if student.id not in marked_ids:
                AttendanceRecord.objects.create(session=session, student=student, status='absent')
                created += 1

        session.is_closed = True
        session.save()
        self.stdout.write(self.style.SUCCESS(f"Marked {created} students absent. Session closed."))