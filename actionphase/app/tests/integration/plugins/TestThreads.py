from django.test import TestCase, RequestFactory
from django.test.utils import override_settings
from actionphase.app.models.games import *
from actionphase.app.models.threads import *
from actionphase.app.views.threads import *


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

    def test_get_create(self):
        request = self.factory.get('/threads/new/')
        request.user = self.user
        response = thread_create(request, self.game.id)
        self.assertEqual(response.status_code, 200)

    def test_post_create(self):
        request = self.factory.post('/threads/new/', {
            'name': 'Brand New Thread',
            'text': 'Test Text'
        }, follow=True)
        request.user = self.user
        response = thread_create(request, self.game.id)
        self.assertEqual(response.status_code, 302)
        thread = Thread.objects.filter(name='Brand New Thread').first()
        self.assertIsNotNone(thread)

    def test_get_view(self):
        request = self.factory.get('/threads/view/')
        request.user = self.user
        response = thread_view(request, self.thread.id)
        self.assertEqual(response.status_code, 200)

    def test_get_update(self):
        request = self.factory.get('/threads/edit/')
        request.user = self.user
        response = thread_update(request, self.thread.id)
        self.assertEqual(response.status_code, 200)

    def test_post_update(self):
        request = self.factory.post('/threads/edit/', {
            'name': 'Updated Thread Name',
            'text': 'Updated Thread Text'
        })
        request.user = self.user
        response = thread_update(request, self.thread.id)
        self.assertEqual(response.status_code, 302)
        thread = Thread.objects.filter(name='Updated Thread Name').first()
        self.assertIsNotNone(thread)

    def test_get_delete(self):
        request = self.factory.get('/threads/delete/')
        request.user = self.user
        response = thread_delete(request, self.thread.id)
        self.assertEqual(response.status_code, 200)

    def test_post_delete(self):
        request = self.factory.post('/threads/delete/')
        request.user = self.user
        thread_id = self.thread.id
        response = thread_delete(request, thread_id)
        self.assertEqual(response.status_code, 302)
        thread = Thread.objects.filter(pk=thread_id).first()
        self.assertIsNone(thread)

    def test_post_comment(self):
        request = self.factory.post('/threads/comment/', {
            'author': self.character.id,
            'game': self.game.id,
            'thread': self.thread.id,
            'text': 'Test Comment'
        }, follow=True)
        request.user = self.user
        response = thread_comment(request)
        self.assertEqual(response.status_code, 302)
        comment = Comment.objects.filter(text='Test Comment').first()
        self.assertIsNotNone(comment)

    def test_post_comment_ajax(self):
        request = self.factory.post('/threads/comment/', {
            'author': self.character.id,
            'game': self.game.id,
            'thread': self.thread.id,
            'text': 'Test Comment'
        }, follow=True, HTTP_X_REQUESTED_WITH='XMLHttpRequest')
        request.user = self.user
        response = thread_comment(request)
        self.assertEqual(response.status_code, 200)
        comment = Comment.objects.filter(text='Test Comment').first()
        self.assertIsNotNone(comment)
