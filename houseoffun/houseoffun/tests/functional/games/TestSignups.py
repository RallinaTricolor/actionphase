from houseoffun.houseoffun.tests.util import BaseStaticLiveServerTestCase
from houseoffun.houseoffun.tests.util import TestHelper
from selenium.webdriver.support import expected_conditions as EC


class SignupsTest(BaseStaticLiveServerTestCase):
    fixtures = ['01-user-data.json', 'game-data.json', '02-plugin-data.json']

    def test_game_list(self):
        self.authenticate()
        self.selenium.get('%s%s' % (self.live_server_url, '/games/'))
        self.selenium.find_element_by_class_name('game-view-link-2').click()
        self.wait.until(EC.url_changes('%s%s' % (self.live_server_url, '/games/')))
        self.selenium.find_element_by_class_name('signup-button-signup').click()
        self.wait.until(EC.url_contains('%s%s' % (self.live_server_url, '/games/view/')))
        self.selenium.find_element_by_class_name('signup-status')