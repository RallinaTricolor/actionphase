from django.contrib.staticfiles.testing import StaticLiveServerTestCase
from django.contrib.sessions.models import Session
from selenium.webdriver.firefox.webdriver import WebDriver
from selenium.webdriver.support.ui import WebDriverWait


class BaseStaticLiveServerTestCase(StaticLiveServerTestCase):
    """
    Extends the default Django Static Live Server Test Case to
    provide common functionality for all tests
    """
    fixtures = ['01-user-data.json']

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
        self.selenium.get(self.live_server_url)
        user_session = Session.objects.first()
        cookie = {
            "name": "sessionid",
            "value": user_session.session_key
        }
        self.selenium.add_cookie(cookie)