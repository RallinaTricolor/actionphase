from django.contrib.staticfiles.testing import StaticLiveServerTestCase
from django.test import Client
from selenium.webdriver.firefox.webdriver import WebDriver
from selenium.webdriver.support.ui import WebDriverWait


class BaseStaticLiveServerTestCase(StaticLiveServerTestCase):
    """
    Extends the default Django Static Live Server Test Case to
    provide common functionality for all tests
    """
    fixtures = ['user-data.json']

    @classmethod
    def setUpClass(cls):
        super(BaseStaticLiveServerTestCase, cls).setUpClass()
        cls.selenium = WebDriver()
        cls.wait = WebDriverWait(cls.selenium, 10)

    @classmethod
    def tearDownClass(cls):
        cls.selenium.quit()
        super(BaseStaticLiveServerTestCase, cls).tearDownClass()

    def authenticate(self):
        """
        Authenticates a test user for tests which require login
        """
        c = Client()
        c.login(username="test_authenticated_user", password="test_auth")