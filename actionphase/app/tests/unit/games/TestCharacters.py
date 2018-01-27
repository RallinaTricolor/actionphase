from django.test import TestCase
from actionphase.app.models.games import *


class CharactersTest(TestCase):
    """
    Test model functionality for the Characters model
    """

    def setUp(self):
        self.user = User.objects.create_user(username='test_user', email='test@example.com', password='test_pass')
        self.game = Game.objects.create(
            name='Sample of Fun',
            abbreviation='SoF',
            description='This is a sample game!',
            game_master=self.user
        )
        self.signup = GameSignup.objects.create(user=self.user, game=self.game)
        self.character = Character.objects.create(name="Test Character", owner=self.user, game=self.game)

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