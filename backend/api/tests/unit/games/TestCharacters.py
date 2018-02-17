from django.test import TestCase
from backend.api.models.games import *


class CharactersTest(TestCase):
    """
    Test model functionality for the Characters model
    """

    def setUp(self):
        self.owner_user = User.objects.create_user(username='owner_user', email='owner@example.com', password='test_pass')
        self.gm_user = User.objects.create_user(username='gm_user', email='gm@example.com', password='test_pass')
        self.other_user = User.objects.create_user(username='other_user', email='other@example.com', password='test_pass')
        self.audience_user = User.objects.create_user(username='audience_user', email='audience@example.com', password='test_pass')
        self.game = Game.objects.create(
            name='Sample of Fun',
            abbreviation='SoF',
            description='This is a sample game!',
            game_master=self.gm_user
        )
        self.signup = GameSignup.objects.create(user=self.owner_user, game=self.game, status=GameSignup.ACCEPTED)
        self.signup = GameSignup.objects.create(user=self.other_user, game=self.game, status=GameSignup.ACCEPTED)
        self.character = Character.objects.create(name="Test Character", owner=self.owner_user, game=self.game)

    def test_can_submit_for_review(self):
        # Test that a character can be submitted for review
        self.assertTrue(self.character.can_submit_for_review())
        self.character.status = Character.FINISHED
        self.assertFalse(self.character.can_submit_for_review())

    def test_can_approve(self):
        # Test that a character in review can be approved or rejected
        self.assertFalse(self.character.can_approve())
        self.character.status = Character.REVIEW
        self.assertTrue(self.character.can_approve())

    def test_get_permission_level(self):
        # Test that the correct permission level is retrieved each time.
        self.assertEqual(Character.OWNER_PERMISSION, self.character.get_permission_level(self.owner_user))
        self.assertEqual(Character.GM_PERMISSION, self.character.get_permission_level(self.gm_user))
        self.assertEqual(Character.OTHER_PLAYER_PERMISSION, self.character.get_permission_level(self.other_user))
        self.assertEqual(Character.AUDIENCE_PERMISSION, self.character.get_permission_level(self.audience_user))
