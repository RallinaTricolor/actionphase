from django.db import models
from django.contrib.auth.models import User

class Game(models.Model):
    name = models.CharField(max_length = 100, unique = True)
    abbreviation = models.CharField(max_length = 10)
    description = models.TextField()
    game_master = models.ForeignKey(
        User,
        on_delete = models.CASCADE
    )
    created_at = models.DateField(auto_now_add = True)