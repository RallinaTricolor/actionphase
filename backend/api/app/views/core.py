from django.http import HttpResponse
from django.contrib.auth.models import User
from rest_framework import serializers, viewsets
from rest_framework import permissions

from api.app.models import Plugin


class PluginSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plugin
        fields = ('id', 'name',)


class PluginListSerializer(PluginSerializer):
    class Meta:
        model = Plugin
        fields = ('id', 'name', 'description')


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username',)


class UserViewSet(viewsets.ModelViewSet):
    permission_classes = (permissions.IsAuthenticated,)
    queryset = User.objects.all()
    serializer_class = UserSerializer


class PluginViewSet(viewsets.ModelViewSet):
    permission_classes = (permissions.IsAuthenticated,)
    queryset = Plugin.objects.all()
    serializer_class = PluginListSerializer


def index(request):
    name = request.user.email if request.user.is_authenticated else 'world'
    return HttpResponse("Hello, " + name + ". You're at the Action Phase index.")
