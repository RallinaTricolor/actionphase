from django.test import TestCase
from django.test.utils import override_settings


@override_settings(STATICFILES_STORAGE='pipeline.storage.NonPackagingPipelineStorage', PIPELINE_ENABLED=False)
class BaseTest(TestCase):
    pass
