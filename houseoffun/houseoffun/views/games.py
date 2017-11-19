from django.shortcuts import render, redirect, get_object_or_404
from django.forms import ModelForm, ModelMultipleChoiceField, CheckboxSelectMultiple
from django.http import HttpResponse
from django.core.exceptions import PermissionDenied

from houseoffun.houseoffun.models import Game, Plugin, Thread

class GameForm(ModelForm):
    class Meta:
        model = Game
        exclude = ['game_master']
    plugins = ModelMultipleChoiceField(queryset=Plugin.objects.all(), widget=CheckboxSelectMultiple, required=False)

def game_list(request, template_name='games/list.html'):
    games = Game.objects.defer('description')
    data = {}
    data['object_list'] = games
    return render(request, template_name, data)

def game_create(request, template_name='games/form.html'):
    form = GameForm(request.POST or None)
    if form.is_valid():
        game = form.save(commit=False)
        game.game_master = request.user
        game.save()
        for plugin in request.POST.getlist('plugins'):
            game.plugins.add(plugin)
        return redirect('game_list')
    return render(request, template_name, {'form': form})

def game_view(request, pk, template_name='games/view.html'):
    game = get_object_or_404(Game, pk=pk)
    threads = []
    if game.has_plugin('Threads'):
        threads = Thread.objects.filter(game=game.id).defer('text')
    return render(request, template_name, {'game': game, 'threads': threads})

def game_update(request, pk, template_name='games/form.html'):
    game = get_object_or_404(Game, pk=pk)
    if game.game_master.id != request.user.id:
        raise PermissionDenied
    form = GameForm(request.POST or None, instance=game)
    if form.is_valid():
        form.save()
        return redirect('game_list')
    return render(request, template_name, {'form': form})

def game_delete(request, pk, template_name='games/confirm_delete.html'):
    game = get_object_or_404(Game, pk=pk)    
    if game.game_master.id != request.user.id:
        raise PermissionDenied
    if request.method=='POST':
        game.delete()
        return redirect('game_list')
    return render(request, template_name, {'object':game})