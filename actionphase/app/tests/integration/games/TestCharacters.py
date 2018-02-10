from django.test import TestCase, RequestFactory

from actionphase.app.models.games import *
from actionphase.app.views.characters import *


class CharactersTest(TestCase):
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
            game_master=self.user,
            status=Game.PENDING
        )
        self.signup = GameSignup.objects.create(user=self.user, game=self.game, status=GameSignup.ACCEPTED)
        self.character = Character.objects.create(name="Test Character", owner=self.user, game=self.game)

    def test_get_view(self):
        # Test the view page for a character
        request = self.factory.get('/characters/view/')
        request.user = self.user
        response = character_view(request, self.character.id)
        self.assertEqual(response.status_code, 200)

    def test_get_update(self):
        # Test viewing the update page for a character
        request = self.factory.get('/characters/edit/')
        request.user = self.user
        response = character_update(request, self.character.id)
        self.assertEqual(response.status_code, 200)

    def test_post_update(self):
        # Test sending data to the update page for a character
        new_name = 'Tester Character'
        request = self.factory.post('/characters/edit/', {
            'name': new_name
        }, follow=True)
        request.user = self.user
        response = character_update(request, self.character.id)
        self.assertEqual(response.status_code, 302)
        self.character.refresh_from_db()
        self.assertEqual(self.character.name, new_name)

    def test_get_character_review(self):
        # Test submitting a character for review
        request = self.factory.get('/characters/review/')
        request.user = self.user
        response = character_review(request, self.character.id)
        self.assertEqual(response.status_code, 302)
        self.character.refresh_from_db()
        self.assertEqual(self.character.status, Character.REVIEW)

    def test_get_character_approve(self):
        # Test submitting a character for review
        self.character.status = Character.REVIEW
        self.character.save()
        request = self.factory.get('/characters/approve/')
        request.user = self.user
        response = character_approve(request, self.character.id)
        self.assertEqual(response.status_code, 302)
        self.character.refresh_from_db()
        self.assertEqual(self.character.status, Character.FINISHED)

    def test_get_character_reject(self):
        # Test submitting a character for review
        self.character.status = Character.REVIEW
        self.character.save()
        request = self.factory.get('/characters/reject/')
        request.user = self.user
        response = character_reject(request, self.character.id)
        self.assertEqual(response.status_code, 302)
        self.character.refresh_from_db()
        self.assertEqual(self.character.status, Character.PROGRESS)
