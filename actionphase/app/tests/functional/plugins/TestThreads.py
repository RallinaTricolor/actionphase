from actionphase.app.tests.util import BaseStaticLiveServerTestCase
from actionphase.app.tests.util import TestHelper
from selenium.webdriver.support import expected_conditions as ec
from selenium.webdriver.common.by import By
from actionphase.app.tests.util import CssMappings as css
from actionphase.app.tests.util import UrlMappings as url


class ThreadsTest(BaseStaticLiveServerTestCase):
    fixtures = [
        '01-user-data.json',
        '02-plugin-data.json',
        '03-game-data.json',
        '04-signup-data.json',
        '05-character-data.json',
        '06-thread-data.json'
    ]

    def test_thread_view(self):
        self.authenticate()
        self.selenium.get('%s%s%s' % (self.live_server_url, '/threads/view/', url.REPLYABLE_THREAD_ID))
        self.selenium.find_element_by_id(css.THREAD_CONTENT_ID)

    def test_thread_comment(self):
        self.authenticate()
        self.selenium.get('%s%s%s' % (self.live_server_url, '/threads/view/', url.REPLYABLE_THREAD_ID))
        self.wait.until(ec.element_to_be_clickable((By.CLASS_NAME, css.THREAD_SUBMIT_BUTTON_CLASS)))
        reply_text = TestHelper.random_string(32)
        text_input = self.selenium.find_element_by_name("text")
        text_input.send_keys(reply_text)
        self.selenium.find_element_by_class_name(css.THREAD_SUBMIT_BUTTON_CLASS).click()
        self.wait.until(ec.visibility_of_element_located((By.CLASS_NAME, css.COMMENT_BODY_CLASS)))
        assert reply_text in self.selenium.page_source
