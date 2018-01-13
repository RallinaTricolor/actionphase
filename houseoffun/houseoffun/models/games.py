from django.db import models
from django.contrib.auth.models import User
from houseoffun.houseoffun.models.core import Plugin
from django.core.exceptions import PermissionDenied
from django.db import transaction, DatabaseError


class Game(models.Model):
    # Game Status Codes
    DRAFT = 'DR'
    REGISTRATION = 'RG'
    PENDING = 'PD'
    RUNNING = 'RN'
    FINISHED = 'FN'
    ARCHIVED = 'AR'
    DELETED = 'DL'

    GAME_STATUS_CHOICES = (
        (DRAFT, 'Draft'),
        (REGISTRATION, 'Recruiting'),
        (PENDING, 'Pending'),
        (RUNNING, 'Running'),
        (FINISHED, 'Finished'),
        (ARCHIVED, 'Archived'),
        (DELETED, 'Deleted'),
    )
    
    name = models.CharField(max_length=100, unique=True)
    abbreviation = models.CharField(max_length=10)
    description = models.TextField()
    game_master = models.ForeignKey(
        User,
        on_delete=models.CASCADE
    )
    created_at = models.DateTimeField(auto_now_add=True)
    plugins = models.ManyToManyField(Plugin)
    status = models.CharField(
        max_length=2,
        choices=GAME_STATUS_CHOICES,
        default=DRAFT,
    )

    def has_plugin(self, plugin_name):
        """
        Returns true if a game has a particular plugin
        """
        return plugin_name in self.plugins.values_list('name', flat=True)

    def can_edit_or_403(self, user):
        """
        Throws a 403 error if a user is not allowed to edit a game
        """
        if user.id != self.game_master.id:
            raise PermissionDenied
        return True

    def next_status(self):
        """
        Advances the game to the next status in the list, performing any necessary state changes
        """
        if self.status == self.DRAFT:
            self._advance_draft()

    def previous_status(self):
        """
        Moves the game backwards in status (if possible), performing any necessary state changes
        """
        if self.status == self.REGISTRATION:
            self._revert_draft()

    def _advance_draft(self):
        """
        Moves a draft to the registration step. Should not be called directly
        """
        self.status = self.REGISTRATION
        self.save()

    def _revert_draft(self):
        """
        Moves a game back to the draft status. Should not be called directly
        """
        self.status = self.DRAFT
        try:
            with transaction.atomic():
                for signup in self.game_signup_set:
                    signup.delete()
                self.save()
        except DatabaseError:
            self.status = self.REGISTRATION

    # Functions related to showing things on the page
    def show_threads(self):
        return self.has_plugin('Threads') and self.status in [
            self.RUNNING,
            self.FINISHED,
            self.ARCHIVED
        ]

    def show_new_threads_link(self):
        return self.has_plugin('Threads') and self.status == self.RUNNING

    def show_registrations(self):
        return self.status in [
            self.REGISTRATION,
            self.PENDING
        ]


class Character(models.Model):
    name = models.CharField(max_length=100)
    game = models.ForeignKey(
        Game,
        null=True,
        on_delete=models.SET_NULL
    )
    owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE
    )
    created_at = models.DateTimeField(auto_now_add=True)


class GameSignup(models.Model):
    class Meta:
        unique_together = ('game', 'user',)

    REGISTERED = 'RG'
    ACCEPTED = 'AC'
    REJECTED = 'RJ'
    WITHDRAWN = 'WD'
    REGISTRATION_STATUS_CHOICES = (
        (REGISTERED, 'Registered'),
        (ACCEPTED, 'Accepted'),
        (REJECTED, 'Rejected'),
        (WITHDRAWN, 'Withdrawn')
    )

    game = models.ForeignKey(
        Game,
        on_delete=models.CASCADE,
        related_name='signups'
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE
    )
    status = models.CharField(
        max_length=2,
        choices=REGISTRATION_STATUS_CHOICES,
        default=REGISTERED,
    )

    def can_signup(self):
        return self.status == self.WITHDRAWN

    def can_withdraw(self):
        return self.status != self.WITHDRAWN

    def can_accept(self):
        return self.status in [
            self.REGISTERED,
            self.REJECTED
        ]

    def can_reject(self):
        return self.status in [
            self.REGISTERED,
            self.ACCEPTED
        ]