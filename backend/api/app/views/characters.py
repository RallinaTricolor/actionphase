from rest_framework import serializers

from api.app.views.core import UserSerializer
from api.app.models import Character


class CharacterSerializer(serializers.ModelSerializer):
    owner = UserSerializer(read_only=True)

    class Meta:
        model = Character
        fields = ('name', 'owner', 'image', 'public_profile')
