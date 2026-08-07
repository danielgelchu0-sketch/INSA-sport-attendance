from django.urls import path
from . import views

urlpatterns = [
    path('status/today/', views.get_today_status, name='api_today_status'),
    path('checkin/', views.api_checkin, name='api_checkin'),
    path('session/qr/', views.get_session_qr_token, name='api_session_qr'),
    path('mentor/dashboard/', views.mentor_dashboard, name='mentor_dashboard'),
    path('mentor/student/<int:student_id>/status/', views.mentor_update_status, name='mentor_update_status'),
    path('mentor/session/time/', views.update_session_time, name='update_session_time'),
    path('history/', views.student_history, name='student_history'),
    path('mentor/sessions/', views.session_history, name='session_history'),
    path('mentor/sessions/<str:date>/', views.session_detail, name='session_detail'),
]
