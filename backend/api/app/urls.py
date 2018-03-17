from django.urls import path, include
from rest_framework import routers

from api.app import views

router = routers.DefaultRouter()
router.register(r'games', views.GameViewSet)
router.register(r'users', views.UserViewSet)


urlpatterns = [
    # API Router URLs
    path('', include(router.urls)),
    # Index
    path('', views.index, name='index'),
    # Games
    #path('games/', views.game_list, name='game_list'),
    path('games/new/', views.game_create, name='game_new'),
    path('games/view/<int:pk>/', views.game_view, name='game_view'),
    path('games/edit/<int:pk>/', views.game_update, name='game_edit'),
    path('games/delete/<int:pk>/', views.game_delete, name='game_delete'),
    path('games/nextStatus/<int:pk>/', views.game_next_status, name='game_next_status'),
    path('games/prevStatus/<int:pk>/', views.game_previous_status, name='game_previous_status'),
    path('games/signup/<int:pk>/', views.game_signup, name='game_signup'),
    path('games/withdraw/<int:pk>/', views.game_withdraw, name='game_withdraw'),
    path('games/accept/<int:pk>/', views.game_signup_accept, name='game_signup_accept'),
    path('games/reject/<int:pk>/', views.game_signup_reject, name='game_signup_reject'),
    # Characters
    path('characters/view/<int:pk>/', views.character_view, name='character_view'),
    path('characters/edit/<int:pk>/', views.character_update, name='character_update'),
    path('characters/review/<int:pk>/', views.character_review, name='character_review'),
    path('characters/approve/<int:pk>/', views.character_approve, name='character_approve'),
    path('characters/reject/<int:pk>/', views.character_reject, name='character_reject'),
    # Threads
    path('threads/new/<int:game_id>/', views.thread_create, name='thread_new'),
    path('threads/view/<int:pk>/', views.thread_view, name='thread_view'),
    path('threads/view/<int:pk>/comment/<int:comment_id>/', views.thread_view, name='thread_view'),
    path('threads/edit/<int:pk>/', views.thread_update, name='thread_edit'),
    path('threads/delete/<int:pk>/', views.thread_delete, name='thread_delete'),
    path('threads/comment/', views.thread_comment, name='thread_comment'),
]
