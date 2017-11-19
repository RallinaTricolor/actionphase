from django.db import models
from django.contrib.auth.models import User
from houseoffun.houseoffun.models.core import Plugin

class Game(models.Model):
    name = models.CharField(max_length = 100, unique = True)
    abbreviation = models.CharField(max_length = 10)
    description = models.TextField()
    game_master = models.ForeignKey(
        User,
        on_delete = models.CASCADE
    )
    created_at = models.DateField(auto_now_add = True)
    plugins = models.ManyToManyField(Plugin)
    
class Character(models.Model):
    name = models.CharField(max_length = 100)
    game = models.ForeignKey(
        Game,
        null = True,
        on_delete = models.SET_NULL
    )
    owner = models.ForeignKey(
        User,
        on_delete = models.CASCADE
    )
    created_at = models.DateField(auto_now_add = True)
