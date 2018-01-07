from houseoffun.houseoffun.tests.util import BaseStaticLiveServerTestCase
from houseoffun.houseoffun.tests.util import TestHelper
from selenium.webdriver.support import expected_conditions as EC


class GamesTest(BaseStaticLiveServerTestCase):
    fixtures = ['user-data.json', 'game-data.json', 'plugin-data.json']

    def test_game_create(self):
        self.authenticate()
        self.selenium.get('%s%s' % (self.live_server_url, '/games/'))
        self.selenium.find_element_by_link_text('New').click()
        self.wait.until(EC.url_to_be('%s%s' % (self.live_server_url, '/games/new/')))
        game_name = TestHelper.random_string(8)
        name_input = self.selenium.find_element_by_name("name")
        name_input.send_keys(game_name)
        abbreviation_input = self.selenium.find_element_by_name("abbreviation")
        abbreviation_input.send_keys(TestHelper.random_string(3))
        description_input = self.selenium.find_element_by_name("description")
        description_input.send_keys(TestHelper.random_string(128))
        self.selenium.find_element_by_xpath('//input[@value="Submit"]').click()
        self.wait.until(EC.url_changes('%s%s' % (self.live_server_url, '/games/new/')))
        self.selenium.find_element_by_link_text(game_name)

    def test_game_update(self):
        self.authenticate()
        self.selenium.get('%s%s' % (self.live_server_url, '/games/'))
        self.selenium.find_element_by_link_text('Edit').click()
        game_name = TestHelper.random_string(8)
        name_input = self.selenium.find_element_by_name("name")
        name_input.send_keys(game_name)
        self.selenium.find_element_by_xpath('//input[@value="Submit"]').click()
        self.wait.until(EC.url_to_be('%s%s' % (self.live_server_url, '/games/')))
        self.selenium.find_element_by_link_text(game_name)
