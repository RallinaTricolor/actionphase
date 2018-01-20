from django.db import IntegrityError
from django.db.models import Q
from django.forms import ModelForm, ModelMultipleChoiceField, CheckboxSelectMultiple
from django.shortcuts import render, redirect, get_object_or_404
from django.core.exceptions import ValidationError
from django.contrib import messages

from houseoffun.houseoffun.models import Game, Character


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
    character.status = Character.REVIEW
    character.save()
    return redirect('character_view', pk=pk)
