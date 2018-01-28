from django.contrib.auth.models import User
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import models
from django.db import transaction, DatabaseError
from django.db.models import Q

from actionphase.app.models.core import Plugin
from actionphase.app.util.ImageUtil import *


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
    character_guidelines = models.TextField(null=True, blank=True)

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
            self._advance_to_registration()
        elif self.status == self.REGISTRATION:
            self._advance_to_pending()
        elif self.status == self.PENDING:
            self._advance_to_running()

    def previous_status(self):
        """
        Moves the game backwards in status (if possible), performing any necessary state changes
        """
        if self.status == self.REGISTRATION:
            self._revert_to_draft()
        elif self.status == self.PENDING:
            self._revert_to_registration()

    def _advance_to_registration(self):
        """
        Moves a draft to the registration step. Should not be called directly
        """
        self.status = self.REGISTRATION
        self.save()

    def _revert_to_draft(self):
        """
        Moves a game back to the draft status. Should not be called directly
        """
        self.status = self.DRAFT
        try:
            with transaction.atomic():
                for signup in self.signups.all():
                    signup.delete()
                self.save()
        except DatabaseError:
            self.status = self.REGISTRATION

    def _advance_to_pending(self):
        """
        Moves a game tpo the pending status. All registrations must be handled before this can be performed
        """
        if all(signup.status != GameSignup.REGISTERED for signup in self.signups.all()):
            try:
                with transaction.atomic():
                    self.status = self.PENDING
                    self._create_characters()
                    self.save()
            except DatabaseError:
                pass
        else:
            raise ValidationError('All user signups must be accepted, rejected, or withdrawn before continuing.')

    def _revert_to_registration(self):
        """
        Moves a game back to the registration status
        """
        self.status = self.REGISTRATION
        for character in self.characters.all():
            character.status = Character.DELETED
            character.save()
        self.save()

    def _advance_to_running(self):
        """
        Moves a game to the running status, which is only possible if all characters are approved
        """
        if all(character.status == Character.FINISHED for character in self.characters.filter(Q(owner__in=self.get_players()))):
            self.status = Game.RUNNING
            self.save()
        else:
            raise ValidationError('All player characters must be approved before continuing.')

    # Helper Functions
    def get_players(self):
        return [user for user in self.signups.values_list('user', flat=True).filter(status=GameSignup.ACCEPTED)]

    def _create_characters(self):
        """
        Creates all characters for the game
        """
        signups = self.signups.filter(status=GameSignup.ACCEPTED)
        for signup in signups:
            character = Character.objects.filter(game=self, owner=signup.user).first()
            if character is not None:
                character.status = Character.PROGRESS
                character.save()
            else:
                self._create_character(signup)

    def _create_character(self, signup):
        """
        Create a character for a user
        :param GameSignup signup:
        """
        character = Character()
        character.game = self
        character.owner = signup.user
        character.name = signup.user.username
        character.save()

    # Functions related to showing things on the page
    def show_threads(self):
        return self.has_plugin('Threads') and self.status in [
            self.RUNNING,
            self.FINISHED,
            self.ARCHIVED
        ]

    def show_new_threads_link(self):
        return self.has_plugin('Threads') and self.status == self.RUNNING

    def show_registration_link(self):
        return self.status == self.REGISTRATION

    def show_registrations(self):
        return self.status in [
            self.REGISTRATION,
            self.PENDING
        ]

    def show_characters(self):
        return self.status not in [
            self.DRAFT,
            self.REGISTRATION,
            self.DELETED
        ]


class Character(models.Model):
    PROGRESS = 'IP'
    REVIEW = 'RV'
    FINISHED = 'FN'
    DELETED = 'DL'
    CHARACTER_STATUS_CHOICES = (
        (PROGRESS, 'In Progress'),
        (REVIEW, 'Ready for Review'),
        (FINISHED, 'Finished'),
        (DELETED, 'Deleted')
    )
    # Permission levels for characters
    # Other players in the game should only be able to see public data
    OTHER_PLAYER_PERMISSION = 1
    # Audience members should be able to see everything but not edit
    AUDIENCE_PERMISSION = 2
    # The owner should be able to see and edit
    OWNER_PERMISSION = 3
    # The GM should be able to approve/reject
    GM_PERMISSION = 4

    name = models.CharField(max_length=100)
    game = models.ForeignKey(
        Game,
        null=True,
        on_delete=models.SET_NULL,
        related_name='characters'
    )
    owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE
    )
    status = models.CharField(
        max_length=2,
        choices=CHARACTER_STATUS_CHOICES,
        default=PROGRESS,
    )
    public_profile = models.TextField(null=True, blank=True)
    private_profile = models.TextField(null=True, blank=True)
    image = models.ImageField(upload_to=ImageUtil.character_directory_path, null=True, blank=True)
    image_version = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def can_edit_or_403(self, user):
        """
        Throws a 403 error if a user is not allowed to edit a game
        """
        if self.get_permission_level(user) < self.OWNER_PERMISSION:
            raise PermissionDenied
        return True

    def can_submit_for_review(self):
        return self.status == self.PROGRESS

    def can_approve(self):
        return self.status == self.REVIEW

    def get_permission_level(self, user):
        other_players = self.game.get_players()
        if user == self.game.game_master:
            return self.GM_PERMISSION
        elif user == self.owner:
            return self.OWNER_PERMISSION
        elif user.id in other_players:
            return self.OTHER_PLAYER_PERMISSION
        else:
            return self.AUDIENCE_PERMISSION


class GameSignup(models.Model):
    class Meta:
        unique_together = ('game', 'user',)

    REGISTERED = 'RG'
    ACCEPTED = 'AC'
    REJECTED = 'RJ'
    REGISTRATION_STATUS_CHOICES = (
        (REGISTERED, 'Registered'),
        (ACCEPTED, 'Accepted'),
        (REJECTED, 'Rejected')
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

    def get_status_text(self):
        old_status = self.status
        if self.game.status != Game.PENDING:
            self.status = self.REGISTERED
        status_text = self.get_status_display()
        self.status = old_status
        return status_text

    def can_signup(self):
        return self.game.status == Game.REGISTRATION

    def can_withdraw(self):
        return self.game.status in [Game.REGISTRATION, Game.PENDING]

    def can_accept(self):
        return self.game.status in [Game.REGISTRATION] and self.status in [self.REGISTERED, self.REJECTED]

    def can_reject(self):
        return self.game.status in [Game.REGISTRATION] and self.status in [self.REGISTERED, self.ACCEPTED]
