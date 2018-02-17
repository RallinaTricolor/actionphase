from django.db import models
from django.contrib.auth.models import User
from mptt.models import MPTTModel, TreeForeignKey
from backend.app.models.games import Game, Character
from markdownx.models import MarkdownxField
from markdownx.utils import markdown


class Thread(models.Model):
    name = models.CharField(max_length=255)
    author = models.ForeignKey(
        User,
        on_delete=models.CASCADE
    )
    game = models.ForeignKey(
        Game,
        on_delete=models.CASCADE
    )
    created_at = models.DateTimeField(auto_now_add=True)
    text = MarkdownxField()

    @property
    def formatted_markdown(self):
        return markdown(self.text, safe_mode='escape')  # pragma: no cover


class Comment(MPTTModel):
    author = models.ForeignKey(
        Character,
        on_delete=models.CASCADE
    )
    thread = models.ForeignKey(
        Thread,
        on_delete=models.CASCADE
    )
    parent = TreeForeignKey('self', related_name='children', null=True, blank=True, db_index=True, on_delete=models.DO_NOTHING)
    created_at = models.DateTimeField(auto_now_add=True)
    text = MarkdownxField()

    class MPTTMeta:
        order_insertion_by = ['-created_at']

    @property
    def formatted_markdown(self):
        return markdown(self.text, safe_mode='escape')  # pragma: no cover
