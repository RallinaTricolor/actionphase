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
    game_master = UserSerializer(read_only=True)

    class Meta:
        model = Game
        fields = ('id', 'name', 'abbreviation', 'get_status_display', 'game_master')


class GameDetailSerializer(GameSerializer):
    plugins = PluginSerializer(many=True, required=False, read_only=True)
    signups = SignupSerializer(many=True, required=False, read_only=True)
    characters = CharacterSerializer(many=True, required=False, read_only=True)

    class Meta:
        model = Game
        fields = (
            'id', 'name', 'abbreviation', 'plugins', 'description', 'character_guidelines', 'get_status_display',
            'game_master', 'signups', 'characters')


class GameViewSet(viewsets.ModelViewSet):
    def get_serializer_class(self):
        if self.action != 'list':
            return GameDetailSerializer
        return GameSerializer

    def perform_create(self, serializer):
        game = serializer.save(game_master=self.request.user)
        plugins = self.request.data['plugins']
        for index, plugin in enumerate(plugins):
            if plugin is not None and plugin['enabled'] is True:
                game.plugins.add(index)

    permission_classes = (permissions.IsAuthenticated,)
    queryset = Game.objects.all()
