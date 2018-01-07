from houseoffun.houseoffun.tests.util import BaseStaticLiveServerTestCase
from selenium.webdriver.support import expected_conditions as EC


class AuthenticationTests(BaseStaticLiveServerTestCase):

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
        logout_button = self.selenium.find_element_by_link_text('Logout')
        logout_button.click()
        self.wait.until(EC.url_to_be('%s%s' % (self.live_server_url, '/accounts/login/')))
