from django.contrib.staticfiles.testing import StaticLiveServerTestCase
from selenium.webdriver.chrome.webdriver import WebDriver

class LoginTest(StaticLiveServerTestCase):
    @classmethod
    def setUpClass(cls):
        super(LoginTest, cls).setUpClass()
        cls.selenium = WebDriver()

    @classmethod
    def tearDownClass(cls):
        cls.selenium.quit()
        super(LoginTest, cls).tearDownClass()

    def test_login(self):
        self.selenium.get('%s%s' % (self.live_server_url, '/accounts/login/'))
        username_input = self.selenium.find_element_by_name("username")
        username_input.send_keys('test_user')
        password_input = self.selenium.find_element_by_name("password")
        password_input.send_keys('test_password')
        self.selenium.find_element_by_xpath('//input[@value="Log in"]').click()
