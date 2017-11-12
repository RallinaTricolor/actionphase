from django.conf.urls import url

from houseoffun.houseoffun import views

urlpatterns = [
    url(r'^$', views.index, name='index'),
    url(r'^games$', views.GameList.as_view(), name='game_list'),
    url(r'^games/new$', views.GameCreate.as_view(), name='game_new'),
    url(r'^games/edit/(?P<pk>\d+)$', views.GameUpdate.as_view(), name='game_edit'),
    url(r'^games/delete/(?P<pk>\d+)$', views.GameDelete.as_view(), name='game_delete'),
]