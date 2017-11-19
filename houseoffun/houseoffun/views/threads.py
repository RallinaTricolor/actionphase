from django.shortcuts import render, redirect, get_object_or_404
from django.forms import ModelForm, ModelMultipleChoiceField, CheckboxSelectMultiple
from django.http import HttpResponse
from django.core.exceptions import PermissionDenied

from houseoffun.houseoffun.models import Game, Plugin, Thread

def thread_view(request, pk, template_name='threads/view.html'):
    thread = get_object_or_404(Thread, pk=pk)
    return render(request, template_name, {'thread': thread})
