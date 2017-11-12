from django.shortcuts import render, redirect, get_object_or_404
from django.forms import ModelForm
from django.http import HttpResponse

from houseoffun.houseoffun.models import Game

def index(request):
    name =  request.user.email if request.user.is_authenticated() else 'world'
    return HttpResponse("Hello, " + name + ". You're at the House of Fun index.")

class GameForm(ModelForm):
    class Meta:
        model = Game
        fields = ['name', 'abbreviation', 'description']

def game_list(request, template_name='games/list.html'):
    games = Game.objects.defer('description')
    data = {}
    data['object_list'] = games
    return render(request, template_name, data)

def game_create(request, template_name='games/form.html'):
    form = GameForm(request.POST or None)
    if form.is_valid():
        form.save()
        return redirect('game_list')
    return render(request, template_name, {'form':form})

def game_update(request, pk, template_name='games/form.html'):
    game = get_object_or_404(Game, pk=pk)
    form = GameForm(request.POST or None, instance=game)
    if form.is_valid():
        form.save()
        return redirect('game_list')
    return render(request, template_name, {'form':form})

def game_delete(request, pk, template_name='games/confirm_delete.html'):
    game = get_object_or_404(Game, pk=pk)    
    if request.method=='POST':
        game.delete()
        return redirect('game_list')
    return render(request, template_name, {'object':game})