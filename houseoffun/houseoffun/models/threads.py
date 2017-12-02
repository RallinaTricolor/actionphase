from django.db import models
from django.contrib.auth.models import User
from houseoffun.houseoffun.models.games import Game

class Thread(models.Model):
    name = models.CharField(max_length = 255)
    author = models.ForeignKey(
        User,
        on_delete = models.CASCADE
    )
    game = models.ForeignKey(
        Game,
        on_delete = models.CASCADE
    )
    created_at = models.DateTimeField(auto_now_add = True)
    text = models.TextField()