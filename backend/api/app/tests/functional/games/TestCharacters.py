from selenium.webdriver.support import expected_conditions as ec

from api.app.tests.util import BaseStaticLiveServerTestCase
from api.app.tests.util import TestHelper
from api.app.tests.util import CssMappings as css
from api.app.tests.util import UrlMappings as urls


class CharactersTest(BaseStaticLiveServerTestCase):
    fixtures = ['01-user-data.json', '02-plugin-data.json', '03-game-data.json', '04-signup-data.json', '05-character-data.json']

    def test_character_view(self):
        self.authenticate()
        self.selenium.get('%s%s%s' % (self.live_server_url, '/games/view/', urls.PENDING_GAME_ID))
        self.selenium.find_element_by_class_name(css.CHARACTER_LINK_CLASS).click()
        self.wait.until(ec.url_contains('%s%s' % (self.live_server_url, '/characters/view/')))
        self.selenium.find_element_by_id(css.CHARACTER_ATTRIBUTES_ID)
        assert 'In Progress' in self.selenium.page_source

    def test_character_update(self):
        self.authenticate()
        self.selenium.get('%s%s%s' % (self.live_server_url, '/characters/view/', urls.EDITABLE_CHARACTER_ID))
        self.selenium.find_element_by_id(css.EDIT_CHARACTER_LINK_ID).click()
        self.wait.until(ec.url_contains('%s%s' % (self.live_server_url, '/characters/edit/')))
        new_character_name = TestHelper.random_string(8)
        name_input = self.selenium.find_element_by_name("name")
        name_input.send_keys(new_character_name)
        self.selenium.find_element_by_class_name(css.CHARACTER_SUBMIT_BUTTON_CLASS).click()
        self.wait.until(ec.url_contains('%s%s' % (self.live_server_url, '/characters/view/')))
        assert new_character_name in self.selenium.page_source

    def test_character_review(self):
        self.authenticate()
        self.selenium.get('%s%s%s' % (self.live_server_url, '/characters/view/', urls.EDITABLE_CHARACTER_ID))
        self.selenium.find_element_by_id(css.CHARACTER_REVIEW_BUTTON_ID).click()
        self.wait.until(ec.url_contains('%s%s' % (self.live_server_url, '/characters/view/')))
        assert 'Ready for Review' in self.selenium.page_source

    def test_character_approve(self):
        self.authenticate()
        self.selenium.get('%s%s%s' % (self.live_server_url, '/characters/view/', urls.REVIEWABLE_CHARACTER_ID))
        self.selenium.find_element_by_id(css.CHARACTER_APPROVE_BUTTON_ID).click()
        self.wait.until(ec.url_contains('%s%s' % (self.live_server_url, '/characters/view/')))
        assert 'Finished' in self.selenium.page_source

    def test_character_reject(self):
        self.authenticate()
        self.selenium.get('%s%s%s' % (self.live_server_url, '/characters/view/', urls.REVIEWABLE_CHARACTER_ID))
        self.selenium.find_element_by_id(css.CHARACTER_REJECT_BUTTON_ID).click()
        self.wait.until(ec.url_contains('%s%s' % (self.live_server_url, '/characters/view/')))
        assert 'In Progress' in self.selenium.page_source
