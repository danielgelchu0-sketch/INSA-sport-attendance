from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from django.contrib.auth import get_user_model

from .models import AttendanceRecord
from .serializers import AttendanceRecordSerializer, SportsSessionSerializer, DashboardRecordSerializer
from .utils import get_or_create_today_session, evaluate_checkin_status, get_current_qr_token
from .permissions import IsMentor

User = get_user_model()

@api_view(['GET'])
@permission_classes([IsMentor])
def mentor_dashboard(request):
    """Mentor-only: all students + today's attendance status, with counters."""
    session = get_or_create_today_session()
    students = User.objects.filter(role='student')

    records = {
        r.student_id: r
        for r in AttendanceRecord.objects.filter(session=session).select_related('student')
    }

    rows = []
    counters = {'present': 0, 'late': 0, 'absent': 0, 'not_marked': 0}

    for student in students:
        record = records.get(student.id)
        if record:
            rows.append(DashboardRecordSerializer(record).data)
            counters[record.status] += 1
        else:
            rows.append({
                'id': None,
                'student_id': student.id,
                'username': student.username,
                'full_name': student.get_full_name() or student.username,
                'status': 'not_marked',
                'checked_in_at': None,
                'note': ''
            })
            counters['not_marked'] += 1

    return Response({
        'session': SportsSessionSerializer(session).data,
        'total': students.count(),
        'counters': counters,
        'students': rows
    })


@api_view(['GET'])
@permission_classes([IsMentor])
def get_session_qr_token(request):
    """Mentor-only: returns the currently-valid rotating QR token."""
    session = get_or_create_today_session()
    token = get_current_qr_token(session)
    elapsed = (timezone.now() - session.qr_token_updated_at).total_seconds()
    return Response({'qr_token': token, 'expires_in': max(0, 30 - int(elapsed))})


@api_view(['PATCH'])
@permission_classes([IsMentor])
def mentor_update_status(request, student_id):
    """Mentor manually overrides a student's status + optional note."""
    session = get_or_create_today_session()
    new_status = request.data.get('status')
    note = request.data.get('note', '')

    if new_status not in ('present', 'late', 'absent'):
        return Response({'error': 'Invalid status.'}, status=status.HTTP_400_BAD_REQUEST)

    record, _ = AttendanceRecord.objects.update_or_create(
        session=session,
        student_id=student_id,
        defaults={'status': new_status, 'note': note, 'marked_by': request.user}
    )
    return Response(DashboardRecordSerializer(record).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_today_status(request):
    """Returns today's session details and current student status in JSON format."""
    session = get_or_create_today_session()
    record = AttendanceRecord.objects.filter(session=session, student=request.user).first()

    session_data = SportsSessionSerializer(session).data
    record_data = AttendanceRecordSerializer(record).data if record else None

    return Response({
        'session': session_data,
        'attendance': record_data,
        'user': {
            'username': request.user.username,
            'role': request.user.role
        }
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def api_checkin(request):
    """API endpoint to process student check-in attempts via JSON payload."""
    token = request.data.get('qr_token')
    session = get_or_create_today_session()
    current = get_current_qr_token(session)

    if token not in (current, session.qr_token_prev):
        return Response({'error': 'Invalid or expired QR code.'}, status=status.HTTP_403_FORBIDDEN)

    if session.is_closed:
        return Response({'error': 'Today session is already closed.'}, status=status.HTTP_400_BAD_REQUEST)

    check_status, msg = evaluate_checkin_status(session)
    if check_status == 'absent':
        return Response({'error': msg}, status=status.HTTP_400_BAD_REQUEST)

    record, created = AttendanceRecord.objects.get_or_create(
        session=session,
        student=request.user,
        defaults={'status': check_status, 'checked_in_at': timezone.now()}
    )

    if not created:
        return Response({'message': f'Already checked in as {record.status.upper()}.'}, status=status.HTTP_200_OK)

    return Response({
        'message': msg,
        'record': AttendanceRecordSerializer(record).data
    }, status=status.HTTP_201_CREATED)