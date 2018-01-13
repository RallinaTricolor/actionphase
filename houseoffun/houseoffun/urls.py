from django.conf.urls import url

from houseoffun.houseoffun import views

urlpatterns = [
    # Index
    url(r'^$', views.index, name='index'),
    # Games
    url(r'^games/$', views.game_list, name='game_list'),
    url(r'^games/new/$', views.game_create, name='game_new'),
    url(r'^games/view/(?P<pk>\d+)/$', views.game_view, name='game_view'),
    url(r'^games/edit/(?P<pk>\d+)/$', views.game_update, name='game_edit'),
    url(r'^games/delete/(?P<pk>\d+)/$', views.game_delete, name='game_delete'),
    url(r'^games/nextStatus/(?P<pk>\d+)/$', views.game_next_status, name='game_next_status'),
    url(r'^games/prevStatus/(?P<pk>\d+)/$', views.game_previous_status, name='game_previous_status'),
    url(r'^games/signup/(?P<pk>\d+)/$', views.game_signup, name='game_signup'),
    url(r'^games/withdraw/(?P<pk>\d+)/$', views.game_withdraw, name='game_withdraw'),
    url(r'^games/accept/(?P<pk>\d+)/$', views.game_signup_accept, name='game_signup_accept'),
    url(r'^games/reject/(?P<pk>\d+)/$', views.game_signup_reject, name='game_signup_reject'),
    # Threads
    url(r'^threads/new/(?P<game_id>\d+)/$', views.thread_create, name='thread_new'),
    url(r'^threads/view/(?P<pk>\d+)/$', views.thread_view, name='thread_view'),
    url(r'^threads/edit/(?P<pk>\d+)/$', views.thread_update, name='thread_edit'),
    url(r'^threads/delete/(?P<pk>\d+)/$', views.thread_delete, name='thread_delete'),
]