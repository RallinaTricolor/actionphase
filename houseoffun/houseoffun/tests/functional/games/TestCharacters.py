from selenium.webdriver.support import expected_conditions as ec

from houseoffun.houseoffun.tests.util import BaseStaticLiveServerTestCase
from houseoffun.houseoffun.tests.util import CssMappings as css


class CharactersTest(BaseStaticLiveServerTestCase):
    fixtures = ['01-user-data.json', '02-plugin-data.json', '03-game-data.json', '04-signup-data.json', '05-character-data.json']

    def test_character_view(self):
        self.authenticate()
        self.selenium.get('%s%s' % (self.live_server_url, '/games/'))
        self.selenium.find_element_by_id(css.PENDING_GAME_LINK).click()
        self.wait.until(ec.url_changes('%s%s' % (self.live_server_url, '/games/')))
        self.selenium.find_element_by_class_name(css.CHARACTER_LINK_CLASS).click()
        self.wait.until(ec.url_contains('%s%s' % (self.live_server_url, '/characters/view/')))
        self.selenium.find_element_by_id(css.CHARACTER_ATTRIBUTES_ID)
        assert 'In Progress' in self.selenium.page_source
