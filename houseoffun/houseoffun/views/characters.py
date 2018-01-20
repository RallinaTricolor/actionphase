from django.forms import ModelForm
from django.shortcuts import render, redirect, get_object_or_404

from houseoffun.houseoffun.models import Character


class CharacterForm(ModelForm):
    class Meta:
        model = Character
        exclude = ['owner', 'game', 'status']


def character_view(request, pk, template_name='characters/view.html'):
    character = get_object_or_404(Character, pk=pk)
    return render(request, template_name, {'character': character})


def character_update(request, pk, template_name='characters/form.html'):
    character = get_object_or_404(Character, pk=pk)
    character.can_edit_or_403(request.user)
    form = CharacterForm(request.POST or None, instance=character)
    if form.is_valid():
        form.save()
        return redirect('character_view', pk=pk)
    return render(request, template_name, {'form': form})


def character_review(request, pk):
    character = get_object_or_404(Character, pk=pk)
    character.can_edit_or_403(request.user)
    if character.can_submit_for_review():
        character.status = Character.REVIEW
        character.save()
    return redirect('character_view', pk=pk)


def character_approve(request, pk):
    character = get_object_or_404(Character, pk=pk)
    if request.user == character.game.game_master and character.can_approve():
        character.status = Character.FINISHED
        character.save()
    return redirect('character_view', pk=pk)


def character_reject(request, pk):
    character = get_object_or_404(Character, pk=pk)
    if request.user == character.game.game_master and character.can_approve():
        character.status = Character.PROGRESS
        character.save()
    return redirect('character_view', pk=pk)
