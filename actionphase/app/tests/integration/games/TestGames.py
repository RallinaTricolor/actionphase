from django.test import RequestFactory

from actionphase.app.models.games import *
from actionphase.app.tests.util import BaseTest
from actionphase.app.views.games import *


class GamesTest(BaseTest):
    """
    Test view functionality for basic game functions
    """

    def setUp(self):
        # Every test needs access to the request factory.
        self.factory = RequestFactory()
        self.user = User.objects.create_user(username='test_user', email='test@example.com', password='test_pass')
        self.game = Game.objects.create(
            name='Sample of Fun',
            abbreviation='SoF',
            description='This is a sample game!',
            game_master=self.user
        )

    def test_get_list(self):
        request = self.factory.get('/games/')
        request.user = self.user
        response = game_list(request)
        self.assertEqual(response.status_code, 200)

    def test_get_create(self):
        request = self.factory.get('/games/new/')
        request.user = self.user
        response = game_create(request)
        self.assertEqual(response.status_code, 200)

    def test_post_create(self):
        request = self.factory.post('/games/new/', {
            'name': 'Test of Fun',
            'abbreviation': 'ToF',
            'description': 'This is a test game!'
        }, follow=True)
        request.user = self.user
        response = game_create(request)
        self.assertEqual(response.status_code, 302)
        game = Game.objects.filter(name='Test of Fun')
        self.assertIsNotNone(game)

    def test_get_view(self):
        request = self.factory.get('/games/view/')
        request.user = self.user
        response = game_view(request, self.game.id)
        self.assertEqual(response.status_code, 200)

    def test_get_update(self):
        request = self.factory.get('/games/edit/')
        request.user = self.user
        response = game_update(request, self.game.id)
        self.assertEqual(response.status_code, 200)

    def test_post_update(self):
        new_name = 'Sample of Fun 2'
        request = self.factory.post('/games/edit/', {
            'name': new_name,
            'abbreviation': self.game.abbreviation,
            'description': self.game.description
        }, follow=True)
        request.user = self.user
        response = game_update(request, self.game.id)
        self.assertEqual(response.status_code, 302)
        self.game.refresh_from_db()
        self.assertEqual(self.game.name, new_name)

    def test_get_delete(self):
        request = self.factory.get('/games/delete/')
        request.user = self.user
        response = game_delete(request, self.game.id)
        self.assertEqual(response.status_code, 200)

    def test_post_delete(self):
        game_id = self.game.id
        request = self.factory.post('/games/delete/')
        request.user = self.user
        response = game_delete(request, game_id)
        self.assertEqual(response.status_code, 302)
        game = Game.objects.filter(pk=game_id).first()
        self.assertIsNone(game)

    def test_get_next_status(self):
        request = self.factory.get('/games/nextStatus/', follow=True)
        request.user = self.user
        response = game_next_status(request, self.game.id)
        self.assertEqual(response.status_code, 302)
        self.game.refresh_from_db()
        self.assertEqual(Game.REGISTRATION, self.game.status)

    def test_get_prev_status(self):
        self.game.next_status()
        request = self.factory.get('/games/prevStatus/', follow=True)
        request.user = self.user
        response = game_previous_status(request, self.game.id)
        self.assertEqual(response.status_code, 302)
        self.game.refresh_from_db()
        self.assertEqual(Game.DRAFT, self.game.status)
