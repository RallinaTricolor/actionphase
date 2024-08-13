from django.test import TestCase, RequestFactory
from django.test.utils import override_settings
from api.app.models.games import *
from api.app.models.threads import *
from api.app.views.threads import *


@override_settings(STATICFILES_STORAGE='pipeline.storage.NonPackagingPipelineStorage')
class ThreadsTest(TestCase):
    """
    Test view functionality for basic thread/comment functions
    """

    def setUp(self):
        # Every test needs access to the request factory.
        self.factory = RequestFactory()
        self.user = User.objects.create_user(username='test_user', email='test@example.com', password='test_pass')
        self.game = Game.objects.create(
            name='Sample of Fun',
            abbreviation='SoF',
            description='This is a sample game!',
            game_master=self.user,
            status=Game.RUNNING
        )
        self.signup = GameSignup.objects.create(user=self.user, game=self.game, status=GameSignup.ACCEPTED)
        self.character = Character.objects.create(name="Test Character", owner=self.user, game=self.game)
        self.thread = Thread.objects.create(name="Test Thread", author=self.user, game=self.game)
