from django.shortcuts import render, redirect, get_object_or_404
from django.forms import ModelForm, ModelMultipleChoiceField, CheckboxSelectMultiple
from django.http import HttpResponse
from django.core.exceptions import PermissionDenied

from houseoffun.houseoffun.models import Game, Plugin, Thread

class ThreadForm(ModelForm):
    class Meta:
        model = Thread
        exclude = ['author', 'game']


def thread_create(request, game_id, template_name='threads/form.html'):
    game = get_object_or_404(Game, pk=game_id)
    game.can_edit_or_403(request.user)
    form = ThreadForm(request.POST or None)
    if form.is_valid():
        thread = form.save(commit=False)
        thread.author = request.user
        thread.game = game
        thread.save()
        return redirect('game_view', game_id)
    return render(request, template_name, {'form': form})

def thread_view(request, pk, template_name='threads/view.html'):
    thread = get_object_or_404(Thread, pk=pk)
    return render(request, template_name, {'thread': thread})
