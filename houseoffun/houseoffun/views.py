from django.shortcuts import render
from django.http import HttpResponse
from django.views.generic import TemplateView,ListView
from django.views.generic.edit import CreateView, UpdateView, DeleteView
from django.core.urlresolvers import reverse_lazy

from houseoffun.houseoffun.models import Game

def index(request):
    name =  request.user.email if request.user.is_authenticated() else 'world'
    return HttpResponse("Hello, " + name + ". You're at the House of Fun index.")

class GameList(ListView):
    model = Game

class GameCreate(CreateView):
    model = Game
    success_url = reverse_lazy('game_list')
    fields = ['name', 'description', 'abbreviation']

class GameUpdate(UpdateView):
    model = Game
    success_url = reverse_lazy('game_list')
    fields = ['name', 'description', 'abbreviation']

class GameDelete(DeleteView):
    model = Game
    success_url = reverse_lazy('game_list')