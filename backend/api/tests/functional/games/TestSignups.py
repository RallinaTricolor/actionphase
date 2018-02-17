from selenium.webdriver.support import expected_conditions as ec

from backend.api.tests.util import BaseStaticLiveServerTestCase
from backend.api.tests.util import CssMappings as css


class SignupsTest(BaseStaticLiveServerTestCase):
    fixtures = ['01-user-data.json', '02-plugin-data.json', '03-game-data.json', '04-signup-data.json']

    def test_game_signup(self):
        self.authenticate()
        self.selenium.get('%s%s' % (self.live_server_url, '/games/'))
        self.selenium.find_element_by_id(css.SIGNUP_GAME_LINK_ID).click()
        self.wait.until(ec.url_changes('%s%s' % (self.live_server_url, '/games/')))
        self.selenium.find_element_by_class_name(css.SIGNUP_BUTTON_CLASS).click()
        self.wait.until(ec.url_contains('%s%s' % (self.live_server_url, '/games/view/')))
        self.selenium.find_element_by_class_name(css.SIGNUP_STATUS_TEXT_CLASS)
        assert 'Registered' in self.selenium.page_source

    def test_game_withdraw(self):
        self.authenticate()
        self.selenium.get('%s%s' % (self.live_server_url, '/games/'))
        self.selenium.find_element_by_id(css.WITHDRAW_GAME_LINK_ID).click()
        self.wait.until(ec.url_changes('%s%s' % (self.live_server_url, '/games/')))
        self.selenium.find_element_by_class_name(css.WITHDRAW_BUTTON_CLASS).click()
        self.wait.until(ec.url_contains('%s%s' % (self.live_server_url, '/games/view/')))
        assert css.SIGNUP_STATUS_TEXT_CLASS not in self.selenium.page_source

    def test_game_accept(self):
        self.authenticate()
        self.selenium.get('%s%s' % (self.live_server_url, '/games/'))
        self.selenium.find_element_by_id(css.PROCESS_SIGNUPS_GAME_LINK_ID).click()
        self.wait.until(ec.url_changes('%s%s' % (self.live_server_url, '/games/')))
        self.selenium.find_element_by_class_name(css.ACCEPT_BUTTON_CLASS).click()
        self.wait.until(ec.url_contains('%s%s' % (self.live_server_url, '/games/view/')))
        self.selenium.find_element_by_class_name(css.SIGNUP_STATUS_TEXT_CLASS)
        assert 'Accepted' in self.selenium.page_source

    def test_game_reject(self):
        self.authenticate()
        self.selenium.get('%s%s' % (self.live_server_url, '/games/'))
        self.selenium.find_element_by_id(css.PROCESS_SIGNUPS_GAME_LINK_ID).click()
        self.wait.until(ec.url_changes('%s%s' % (self.live_server_url, '/games/')))
        self.selenium.find_element_by_class_name(css.REJECT_BUTTON_CLASS).click()
        self.wait.until(ec.url_contains('%s%s' % (self.live_server_url, '/games/view/')))
        self.selenium.find_element_by_class_name(css.SIGNUP_STATUS_TEXT_CLASS)
        assert 'Rejected' in self.selenium.page_source
