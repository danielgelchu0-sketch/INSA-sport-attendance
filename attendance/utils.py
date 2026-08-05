import secrets
from datetime import time
from django.utils import timezone
from .models import SportsSession

def get_or_create_today_session():
    """Fetches today's session or creates a new one with a secure token."""
    today = timezone.now().date()
    session, created = SportsSession.objects.get_or_create(
        date=today,
        defaults={
            'qr_token': secrets.token_urlsafe(32),
            'start_time': time(6, 0),
            'late_until': time(6, 15),
        }
    )
    return session

def evaluate_checkin_status(session):
    """
    Evaluates current time against session rules.
    Returns ('status', 'message') tuple.
    """
    now_time = timezone.localtime(timezone.now()).time()
    
    if now_time < session.start_time:
        return 'present', 'Successfully marked Present!'
    elif session.start_time <= now_time <= session.late_until:
        return 'late', 'Marked Late (Arrived after 6:00 AM).'
    else:
        return 'absent', 'Check-in closed. Marked Absent.'

def get_current_qr_token(session):
    """Rotates the QR token every 30s, keeping the previous one valid briefly
    to avoid punishing a student mid-scan when rotation happens."""
    now = timezone.now()
    elapsed = (now - session.qr_token_updated_at).total_seconds()
    if elapsed >= 30:
        session.qr_token_prev = session.qr_token
        session.qr_token = secrets.token_urlsafe(32)
        session.qr_token_updated_at = now
        session.save(update_fields=['qr_token', 'qr_token_prev', 'qr_token_updated_at'])
    return session.qr_token