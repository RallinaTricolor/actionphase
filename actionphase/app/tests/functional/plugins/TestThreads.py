from actionphase.app.tests.util import BaseStaticLiveServerTestCase
from actionphase.app.tests.util import TestHelper
from selenium.webdriver.support import expected_conditions as ec
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
        self.selenium.get('%s%s%s' % (self.live_server_url, '/thrads/', url.REPLYABLE_THREAD_ID))
        self.selenium.find_element_by_id(css.THREAD_CONTENT_ID)
