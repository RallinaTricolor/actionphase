from backend.app.tests.util import BaseStaticLiveServerTestCase
from backend.app.tests.util import TestHelper
from selenium.webdriver.support import expected_conditions as ec
from backend.app.tests.util import CssMappings as css


class GamesTest(BaseStaticLiveServerTestCase):
    fixtures = ['01-user-data.json', '03-game-data.json', '02-plugin-data.json']

    def test_game_list(self):
        self.authenticate()
        self.selenium.get('%s%s' % (self.live_server_url, '/games/'))
        self.selenium.find_element_by_class_name(css.GAME_LINK_CLASS)

    def test_game_view(self):
        self.authenticate()
        self.selenium.get('%s%s' % (self.live_server_url, '/games/'))
        self.selenium.find_element_by_class_name(css.GAME_LINK_CLASS).click()
        self.wait.until(ec.url_changes('%s%s' % (self.live_server_url, '/games/')))
        self.selenium.find_element_by_class_name(css.GAME_STATUS_TEXT_CLASS)

    def test_game_create(self):
        self.authenticate()
        self.selenium.get('%s%s' % (self.live_server_url, '/games/'))
        self.selenium.find_element_by_link_text('New').click()
        self.wait.until(ec.url_to_be('%s%s' % (self.live_server_url, '/games/new/')))
        game_name = TestHelper.random_string(8)
        name_input = self.selenium.find_element_by_name("name")
        name_input.send_keys(game_name)
        abbreviation_input = self.selenium.find_element_by_name("abbreviation")
        abbreviation_input.send_keys(TestHelper.random_string(3))
        description_input = self.selenium.find_element_by_name("description")
        description_input.send_keys(TestHelper.random_string(128))
        self.selenium.find_element_by_class_name(css.GAME_SUBMIT_BUTTON_CLASS).click()
        self.wait.until(ec.url_changes('%s%s' % (self.live_server_url, '/games/new/')))
        self.selenium.find_element_by_link_text(game_name)

    def test_game_update(self):
        self.authenticate()
        self.selenium.get('%s%s' % (self.live_server_url, '/games/'))
        self.selenium.find_element_by_class_name(css.GAME_EDIT_LINK_CLASS).click()
        game_name = TestHelper.random_string(8)
        name_input = self.selenium.find_element_by_name("name")
        name_input.clear()
        name_input.send_keys(game_name)
        self.selenium.find_element_by_class_name(css.GAME_SUBMIT_BUTTON_CLASS).click()
        self.wait.until(ec.url_to_be('%s%s' % (self.live_server_url, '/games/')))
        self.selenium.find_element_by_link_text(game_name)

    def test_game_delete(self):
        self.authenticate()
        self.selenium.get('%s%s' % (self.live_server_url, '/games/'))
        game_name = self.selenium.find_element_by_class_name(css.GAME_LINK_CLASS).text
        self.selenium.find_element_by_class_name(css.GAME_DELETE_LINK_CLASS).click()
        self.wait.until(ec.url_changes('%s%s' % (self.live_server_url, '/games/')))
        self.selenium.find_element_by_class_name(css.GAME_CONFIRM_DELETE_CLASS).click()
        self.wait.until(ec.url_to_be('%s%s' % (self.live_server_url, '/games/')))
        assert game_name not in self.selenium.page_source
