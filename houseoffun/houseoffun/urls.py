from django.conf.urls import url

from houseoffun.houseoffun import views

urlpatterns = [
    # Index
    url(r'^$', views.index, name='index'),
    # Games
    url(r'^games$', views.game_list, name='game_list'),
    url(r'^games/new$', views.game_create, name='game_new'),
    url(r'^games/view/(?P<pk>\d+)$', views.game_view, name='game_view'),
    url(r'^games/edit/(?P<pk>\d+)$', views.game_update, name='game_edit'),
    url(r'^games/delete/(?P<pk>\d+)$', views.game_delete, name='game_delete'),
    # Threads
    url(r'^threads/view/(?P<pk>\d+)$', views.thread_view, name='thread_view'),
]