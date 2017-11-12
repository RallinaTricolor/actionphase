from django.conf.urls import url

from houseoffun.houseoffun import views

urlpatterns = [
    url(r'^$', views.index, name='index'),
    url(r'^games$', views.game_list, name='game_list'),
    url(r'^games/new$', views.game_create, name='game_new'),
    url(r'^games/edit/(?P<pk>\d+)$', views.game_update, name='game_edit'),
    url(r'^games/delete/(?P<pk>\d+)$', views.game_delete, name='game_delete'),
]