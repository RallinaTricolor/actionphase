from django.test import TestCase, RequestFactory

from api.app.models.games import *
from api.app.views.games import *


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