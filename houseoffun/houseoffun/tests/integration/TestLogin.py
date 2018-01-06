from django.contrib.staticfiles.testing import StaticLiveServerTestCase
from selenium.webdriver.firefox.webdriver import WebDriver
from django.conf import settings

class LoginTest(LiveServerTestCase):
    @classmethod
    def setUpClass(cls):
        super(LoginTest, cls).setUpClass()
        cls.selenium = WebDriver()
        #settings.DEBUG = True

    @classmethod
    def tearDownClass(cls):
        cls.selenium.quit()
        super(LoginTest, cls).tearDownClass()

    def test_login(self):
        self.selenium.get('%s%s' % (self.live_server_url, '/accounts/login/'))
        print(self.selenium.page_source)
        username_input = self.selenium.find_element_by_name("username")
        username_input.send_keys('test_user')
        password_input = self.selenium.find_element_by_name("password")
        password_input.send_keys('test_password')
        self.selenium.find_element_by_xpath('//input[@value="Log in"]').click()
