from houseoffun.houseoffun.tests.util import BaseStaticLiveServerTestCase
from houseoffun.houseoffun.tests.util import TestHelper
from selenium.webdriver.support import expected_conditions as EC


class AuthenticationTests(BaseStaticLiveServerTestCase):

    def test_registration(self):
        self.selenium.get('%s%s' % (self.live_server_url, '/accounts/register/'))
        username_input = self.selenium.find_element_by_name("username")
        username_input.send_keys(TestHelper.random_string(8))
        email_input = self.selenium.find_element_by_name("email")
        email_input.send_keys(TestHelper.random_string(8) + '@' + TestHelper.random_string(8) + '.com')
        password = TestHelper.random_string(10)
        password_input = self.selenium.find_element_by_name("password1")
        password_input.send_keys(password)
        password_confirm = self.selenium.find_element_by_name("password2")
        password_confirm.send_keys(password)
        self.selenium.find_element_by_xpath('//input[@value="Submit"]').click()
        self.wait.until(EC.url_changes('%s%s' % (self.live_server_url, '/accounts/register/')))
        self.selenium.find_element_by_link_text('Logout')

    def test_login(self):
        self.selenium.get('%s%s' % (self.live_server_url, '/accounts/login/'))
        username_input = self.selenium.find_element_by_name("username")
        username_input.send_keys('test_user')
        password_input = self.selenium.find_element_by_name("password")
        password_input.send_keys('test_password')
        self.selenium.find_element_by_xpath('//input[@value="Log in"]').click()
        self.wait.until(EC.url_changes('%s%s' % (self.live_server_url, '/accounts/login/')))
        self.selenium.find_element_by_link_text('Logout')

    def test_logout(self):
        self.authenticate()
        self.selenium.get('%s%s' % (self.live_server_url, '/games/'))
        self.selenium.find_element_by_link_text('Logout').click()
        self.wait.until(EC.url_to_be('%s%s' % (self.live_server_url, '/accounts/login/')))

    def test_forgot_password(self):
        self.selenium.get('%s%s' % (self.live_server_url, '/accounts/login/'))
        self.selenium.find_element_by_link_text('Reset it').click()
        self.wait.until(EC.url_to_be('%s%s' % (self.live_server_url, '/accounts/password/reset/')))
        email_input = self.selenium.find_element_by_name("email")
        email_input.send_keys(TestHelper.random_string(8) + '@' + TestHelper.random_string(8) + '.com')
        self.selenium.find_element_by_xpath('//input[@value="Reset password"]').click()
        self.wait.until(EC.url_to_be('%s%s' % (self.live_server_url, '/accounts/password/reset/done/')))
