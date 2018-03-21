from django.db import IntegrityError
from django.db.models import Q
from django.forms import ModelForm, ModelMultipleChoiceField, CheckboxSelectMultiple
from django.shortcuts import render, redirect, get_object_or_404
from django.core.exceptions import ValidationError
from django.contrib import messages
from rest_framework import serializers, viewsets
from rest_framework import permissions

from api.app.views.core import UserSerializer, PluginSerializer
from api.app.views.characters import CharacterSerializer
from api.app.models import Game, GameSignup, Plugin


class SignupSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = GameSignup
        fields = ('id', 'user', 'get_status_display')


class GameSerializer(serializers.ModelSerializer):
    class Meta:
        model = Game
        fields = ('id', 'name', 'abbreviation', 'description', 'get_status_display')


class GameDetailSerializer(serializers.HyperlinkedModelSerializer):
    game_master = UserSerializer(read_only=True)
    plugins = PluginSerializer(many=True)
    signups = SignupSerializer(many=True)
    characters = CharacterSerializer(many=True)

    class Meta:
        model = Game
        fields = (
            'id', 'name', 'abbreviation', 'plugins', 'description', 'character_guidelines', 'get_status_display',
            'game_master', 'signups', 'characters')


class GameForm(ModelForm):
    class Meta:
        model = Game
        exclude = ['game_master', 'status']

    plugins = ModelMultipleChoiceField(queryset=Plugin.objects.all(), widget=CheckboxSelectMultiple, required=False)


class GameViewSet(viewsets.ModelViewSet):
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return GameDetailSerializer
        return GameSerializer

    permission_classes = (permissions.IsAuthenticated,)
    queryset = Game.objects.all()


def game_list(request, template_name='games/list.html'):
    games = Game.objects.filter(
        Q(game_master=request.user) | Q(status__in=[Game.REGISTRATION, Game.PENDING, Game.RUNNING])
    ).defer('description', 'character_guidelines')
    data = {'object_list': games}
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
    threads = False
    if game.has_plugin('Threads'):
        threads = game.thread_set.defer('text')
    user_signup = game.signups.filter(user=request.user).first()
    return render(request, template_name, {'game': game, 'threads': threads, 'user_signup': user_signup})


def game_update(request, pk, template_name='games/form.html'):
    game = get_object_or_404(Game, pk=pk)
    game.can_edit_or_403(request.user)
    form = GameForm(request.POST or None, instance=game)
    if form.is_valid():
        form.save()
        return redirect('game_list')
    return render(request, template_name, {'form': form})


def game_delete(request, pk, template_name='games/confirm_delete.html'):
    game = get_object_or_404(Game, pk=pk)
    game.can_edit_or_403(request.user)
    if request.method == 'POST':
        game.delete()
        return redirect('game_list')
    return render(request, template_name, {'object': game})


def game_next_status(request, pk):
    # TODO: Add javascript confirm button to template file
    game = get_object_or_404(Game, pk=pk)
    game.can_edit_or_403(request.user)
    try:
        game.next_status()
    except ValidationError as e:
        messages.error(request, e.message)
    return redirect('game_view', pk)


def game_previous_status(request, pk):
    # TODO: Add javascript confirm button to template file
    game = get_object_or_404(Game, pk=pk)
    game.can_edit_or_403(request.user)
    game.previous_status()
    return redirect('game_view', pk)


def game_signup(request, pk):
    game = get_object_or_404(Game, pk=pk)
    if request.user == game.game_master:
        # Don't let game master register for their own game...
        return redirect('game_view', pk)
    signup = GameSignup.objects.filter(game=game, user=request.user).first()
    if signup is not None:
        # Don't allow multiple signups from the same user
        return redirect('game_view', pk)
    signup = GameSignup()
    signup.game = game
    signup.user = request.user
    if signup.can_signup():
        try:
            signup.status = signup.REGISTERED
            signup.save()
            game.signups.add(signup)
        except IntegrityError:
            pass
    return redirect('game_view', pk)


def game_withdraw(request, pk):
    game = get_object_or_404(Game, pk=pk)
    signup = get_object_or_404(GameSignup, game=game, user=request.user)
    if signup.can_withdraw():
        signup.delete()
    return redirect('game_view', pk)


def game_signup_accept(request, pk):
    signup = get_object_or_404(GameSignup, pk=pk)
    signup.game.can_edit_or_403(request.user)
    if signup.can_accept():
        signup.status = signup.ACCEPTED
        signup.save()
    return redirect('game_view', signup.game.id)


def game_signup_reject(request, pk):
    signup = get_object_or_404(GameSignup, pk=pk)
    signup.game.can_edit_or_403(request.user)
    if signup.can_reject():
        signup.status = signup.REJECTED
        signup.save()
    return redirect('game_view', signup.game.id)
