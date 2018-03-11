from api.app.tests.util import BaseStaticLiveServerTestCase
from api.app.tests.util import TestHelper
from selenium.webdriver.support import expected_conditions as ec
from selenium.webdriver.common.by import By
from api.app.tests.util import CssMappings as css
from api.app.tests.util import UrlMappings as url


class ThreadsTest(BaseStaticLiveServerTestCase):
    fixtures = [
        '01-user-data.json',
        '02-plugin-data.json',
        '03-game-data.json',
        '04-signup-data.json',
        '05-character-data.json',
        '06-thread-data.json',
        '07-comment-data.json'
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

    def test_comment_reply(self):
        self.authenticate()
        self.selenium.get('%s%s%s' % (self.live_server_url, '/threads/view/', url.REPLYABLE_THREAD_ID))
        self.wait.until(ec.element_to_be_clickable((By.ID, '%s%s' % (css.REPLY_LINK_ID, url.TEST_COMMENT_ID))))
        reply_text = TestHelper.random_string(32)
        self.selenium.find_element_by_id('%s%s' % (css.REPLY_LINK_ID, url.TEST_COMMENT_ID)).click()
        self.wait.until(ec.element_to_be_clickable((By.ID, '%s%s' % (css.REPLY_SUBMIT_BUTTON_ID, url.TEST_COMMENT_ID))))
        text_input = self.selenium.find_element_by_id('%s%s' % (css.REPLY_TEXT_FIELD_ID, url.TEST_COMMENT_ID))
        text_input.send_keys(reply_text)
        self.selenium.find_element_by_id('%s%s' % (css.REPLY_SUBMIT_BUTTON_ID, url.TEST_COMMENT_ID)).click()
        self.wait.until(ec.text_to_be_present_in_element((By.ID, 'thread'), reply_text))

    def test_comment_view(self):
        self.authenticate()
        self.selenium.get('%s%s%s' % (self.live_server_url, '/threads/view/', url.REPLYABLE_THREAD_ID))
        self.wait.until(ec.element_to_be_clickable((By.ID, '%s%s' % (css.PERMALINK_ID, url.TEST_COMMENT_ID))))
        self.selenium.find_element_by_id('%s%s' % (css.PERMALINK_ID, url.TEST_COMMENT_ID)).click()
        self.wait.until(ec.url_contains('/comment/' + url.TEST_COMMENT_ID))
