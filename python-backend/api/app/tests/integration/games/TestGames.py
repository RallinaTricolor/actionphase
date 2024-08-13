from rest_framework.test import APITestCase
from rest_framework import status
from django.urls import reverse

from api.app.models.games import *
from api.app.views.games import *


class GamesTest(APITestCase):
    """
    Test view functionality for basic game functions
    """

    def setUp(self):
        self.user = User.objects.create_user(username='test_user', email='test@example.com', password='test_pass')
        self.game = Game.objects.create(
            name='Sample of Fun',
            abbreviation='SoF',
            description='This is a sample game!',
            game_master=self.user
        )
        self.client.force_authenticate(user=self.user)

    def test_games_list(self):
        url = reverse('games-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertContains(response, self.game.name)
