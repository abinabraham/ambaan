from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

auth_urlpatterns = [
    path("register/", views.RegisterView.as_view(), name="auth-register"),
    path("login/", views.LoginView.as_view(), name="auth-login"),
    path("refresh/", TokenRefreshView.as_view(), name="auth-refresh"),
    path("logout/", views.LogoutView.as_view(), name="auth-logout"),
]

account_urlpatterns = [
    path("profile/", views.ProfileView.as_view(), name="profile"),
    path("password/", views.ChangePasswordView.as_view(), name="change-password"),
]
