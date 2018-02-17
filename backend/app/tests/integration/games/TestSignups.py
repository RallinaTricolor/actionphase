from django.test import TestCase, RequestFactory

from backend.app.models.games import *
from backend.app.views.games import *


class SignupsTest(TestCase):
    """
    Test view functionality for basic game functions
    """

    def setUp(self):
        # Every test needs access to the request factory.
        self.factory = RequestFactory()
        self.game_master = User.objects.create_user(username='game_master', email='gm@example.com',
                                                    password='test_pass')
        self.user = User.objects.create_user(username='test_user', email='test@example.com', password='test_pass')
        self.game = Game.objects.create(
            name='Sample of Fun',
            abbreviation='SoF',
            description='This is a sample game!',
            game_master=self.game_master,
            status=Game.REGISTRATION
        )

    def test_game_signup(self):
        request = self.factory.get('/games/signup/')
        request.user = self.user
        response = game_signup(request, self.game.id)
        self.assertEqual(response.status_code, 302)
        signup = GameSignup.objects.filter(user=self.user, game=self.game).first()
        self.assertIsNotNone(signup)

    def test_gamemaster_signup_failure(self):
        # A gamemaster shouldn't be able to sign up for their own game
        request = self.factory.get('/games/signup/')
        request.user = self.game_master
        response = game_signup(request, self.game.id)
        self.assertEqual(response.status_code, 302)
        signup = GameSignup.objects.filter(user=self.game_master, game=self.game).first()
        self.assertIsNone(signup)

    def test_double_signup_failure(self):
        # A user shouldn't be able to sign up for the same game twice
        GameSignup.objects.create(user=self.user, game=self.game)
        request = self.factory.get('/games/signup/')
        request.user = self.user
        response = game_signup(request, self.game.id)
        self.assertEqual(response.status_code, 302)
        signups = GameSignup.objects.filter(user=self.user, game=self.game)
        self.assertEqual(1, len(signups))

    def test_game_withdraw(self):
        signup = GameSignup.objects.create(user=self.user, game=self.game)
        signup_id = signup.id
        request = self.factory.get('/games/withdraw/')
        request.user = self.user
        response = game_withdraw(request, self.game.id)
        self.assertEqual(response.status_code, 302)
        signup = GameSignup.objects.filter(pk=signup_id).first()
        self.assertIsNone(signup)

    def test_game_accept(self):
        signup = GameSignup.objects.create(user=self.user, game=self.game)
        request = self.factory.get('/games/accept/')
        request.user = self.game_master
        response = game_signup_accept(request, signup.id)
        self.assertEqual(response.status_code, 302)
        signup.refresh_from_db()
        self.assertEqual(GameSignup.ACCEPTED, signup.status)

    def test_game_reject(self):
        signup = GameSignup.objects.create(user=self.user, game=self.game)
        request = self.factory.get('/games/reject/')
        request.user = self.game_master
        response = game_signup_reject(request, signup.id)
        self.assertEqual(response.status_code, 302)
        signup.refresh_from_db()
        self.assertEqual(GameSignup.REJECTED, signup.status)
