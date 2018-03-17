from django.http import HttpResponse
from django.contrib.auth.models import User
from rest_framework import serializers, viewsets
from rest_framework import permissions


class UserSerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = User
        fields = ('username',)


class UserViewSet(viewsets.ModelViewSet):
    permission_classes = (permissions.IsAuthenticated,)
    queryset = User.objects.all()
    serializer_class = UserSerializer


def index(request):
    name = request.user.email if request.user.is_authenticated else 'world'
    return HttpResponse("Hello, " + name + ". You're at the Action Phase index.")
