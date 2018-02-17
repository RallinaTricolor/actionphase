from django.test import TestCase
from api.app.models.games import *


class SignupsTest(TestCase):
    """
    Test model functionality for the GameSignup model
    """

    def setUp(self):
        self.game_master = User.objects.create_user(username='game_master', email='gm@example.com',
                                                    password='test_pass')
        self.user = User.objects.create_user(username='test_user', email='test@example.com', password='test_pass')
        self.game = Game.objects.create(
            name='Sample of Fun',
            abbreviation='SoF',
            description='This is a sample game!',
            game_master=self.game_master
        )
        self.signup = GameSignup.objects.create(user=self.user, game=self.game)

    def test_can_signup(self):
        # Already created signup shouldn't be able to signup again
        self.assertFalse(self.signup.can_signup())
        self.assertFalse(self.signup.can_signup())
        self.game.status = Game.REGISTRATION
        # Withdrawn signups should be able to re-register
        self.assertTrue(self.signup.can_signup())
        self.signup.status = GameSignup.REGISTERED
        self.signup.pk = None
        # New signups should be able to signup
        self.assertTrue(self.signup.can_signup())

    def test_can_withdraw(self):
        # Game is a draft so new signups shouldn't be possible
        self.assertFalse(self.signup.can_withdraw())
        self.game.status = Game.REGISTRATION
        # Signed up users should be able to withdraw
        self.assertTrue(self.signup.can_withdraw())

    def test_can_accept(self):
        # Game is a draft so new signups shouldn't be possible
        self.assertFalse(self.signup.can_accept())
        self.game.status = Game.REGISTRATION
        # Users who signed up can be accepted
        self.assertTrue(self.signup.can_accept())
        self.signup.status = GameSignup.ACCEPTED
        # Already accepted users can't be accepted again
        self.assertFalse(self.signup.can_accept())

    def test_can_reject(self):
        # Game is a draft so new signups shouldn't be possible
        self.assertFalse(self.signup.can_reject())
        self.game.status = Game.REGISTRATION
        # Users who signed up can be rejected
        self.assertTrue(self.signup.can_reject())
        self.signup.status = GameSignup.REJECTED
        # Already rejected users can't be rejected again
        self.assertFalse(self.signup.can_reject())

    def test_get_status_text(self):
        # Verify that users only see registered/withdrawn before game is marked as pending
        self.game.status = Game.REGISTRATION
        self.signup.status = GameSignup.REGISTERED
        registration_text = self.signup.get_status_display()
        self.assertEqual(registration_text, self.signup.get_status_text())

        self.signup.status = GameSignup.ACCEPTED
        self.assertEqual(registration_text, self.signup.get_status_text())

        self.signup.status = GameSignup.REJECTED
        self.assertEqual(registration_text, self.signup.get_status_text())

        # Changing status to pending should show true status now
        self.game.status = Game.PENDING

        self.signup.status = GameSignup.ACCEPTED
        accepted_text = self.signup.get_status_display()
        self.assertEqual(accepted_text, self.signup.get_status_text())

        self.signup.status = GameSignup.REJECTED
        rejected_text = self.signup.get_status_display()
        self.assertEqual(rejected_text, self.signup.get_status_text())
