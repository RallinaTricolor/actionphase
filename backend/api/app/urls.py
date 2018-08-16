from django.urls import path, include
from rest_framework import routers

from api.app import views

router = routers.DefaultRouter()
router.register(r'games', views.GameViewSet, 'games')
router.register(r'users', views.UserViewSet, 'users')
router.register(r'plugins', views.PluginViewSet, 'plugins')


urlpatterns = [
    # API Router URLs
    path('', include(router.urls)),
]
