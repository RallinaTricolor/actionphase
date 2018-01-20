from django.db import IntegrityError
from django.db.models import Q
from django.forms import ModelForm, ModelMultipleChoiceField, CheckboxSelectMultiple
from django.shortcuts import render, redirect, get_object_or_404
from django.core.exceptions import ValidationError
from django.contrib import messages

from houseoffun.houseoffun.models import Game, Character


def character_view(request, pk, template_name='characters/view.html'):
    character = get_object_or_404(Character, pk=pk)
    return render(request, template_name, {'character': character})
