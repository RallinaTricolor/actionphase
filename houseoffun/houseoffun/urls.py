from django.conf.urls import url

from houseoffun.houseoffun.views.core import *
from houseoffun.houseoffun.views.games import *
from houseoffun.houseoffun.views.threads import *


urlpatterns = [
    # Index
    url(r'^$', index, name='index'),
    # Games
    url(r'^games/?$', game_list, name='game_list'),
    url(r'^games/new/?$', game_create, name='game_new'),
    url(r'^games/view/(?P<pk>\d+)/?$', game_view, name='game_view'),
    url(r'^games/edit/(?P<pk>\d+)/?$', game_update, name='game_edit'),
    url(r'^games/delete/(?P<pk>\d+)/?$', game_delete, name='game_delete'),
    # Threads
    url(r'^threads/new/(?P<game_id>\d+)/?$', thread_create, name='thread_new'),
    url(r'^threads/view/(?P<pk>\d+)/?$', thread_view, name='thread_view'),
    url(r'^threads/edit/(?P<pk>\d+)/?$', thread_update, name='thread_edit'),
    url(r'^threads/delete/(?P<pk>\d+)/?$', thread_delete, name='thread_delete'),
]