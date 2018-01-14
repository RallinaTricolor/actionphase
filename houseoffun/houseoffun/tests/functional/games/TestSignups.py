from houseoffun.houseoffun.tests.util import BaseStaticLiveServerTestCase
from houseoffun.houseoffun.tests.util import TestHelper
from selenium.webdriver.support import expected_conditions as EC


class SignupsTest(BaseStaticLiveServerTestCase):
    fixtures = ['01-user-data.json', '02-plugin-data.json', '03-game-data.json', '04-signup-data.json']

    def test_game_signup(self):
        self.authenticate()
        self.selenium.get('%s%s' % (self.live_server_url, '/games/'))
        self.selenium.find_element_by_class_name('game-view-link-2').click()
        self.wait.until(EC.url_changes('%s%s' % (self.live_server_url, '/games/')))
        self.selenium.find_element_by_class_name('signup-button-signup').click()
        self.wait.until(EC.url_contains('%s%s' % (self.live_server_url, '/games/view/')))
        self.selenium.find_element_by_class_name('signup-status')
        assert 'Registered' in self.selenium.page_source

    def test_game_withdraw(self):
        self.authenticate()
        self.selenium.get('%s%s' % (self.live_server_url, '/games/'))
        self.selenium.find_element_by_class_name('game-view-link-3').click()
        self.wait.until(EC.url_changes('%s%s' % (self.live_server_url, '/games/')))
        self.selenium.find_element_by_class_name('signup-button-withdraw').click()
        self.wait.until(EC.url_contains('%s%s' % (self.live_server_url, '/games/view/')))
        self.selenium.find_element_by_class_name('signup-status')
        assert 'Withdrawn' in self.selenium.page_source