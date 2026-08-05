from django.urls import path
from .views import CSRFView, RegisterView, LoginView, LogoutView, MeView

urlpatterns = [
    path('csrf/', CSRFView.as_view()),
    path('register/', RegisterView.as_view()),
    path('login/', LoginView.as_view()),
    path('logout/', LogoutView.as_view()),
    path('me/', MeView.as_view()),
]