from storages.backends.s3boto3 import S3Boto3Storage
from django.contrib.staticfiles.storage import CachedFilesMixin
from pipeline.storage import PipelineMixin


class S3PipelineStorage(PipelineMixin, CachedFilesMixin, S3Boto3Storage):
    location = 'static'
    file_overwrite = True
    object_parameters = {
        # Cache static assets for one year
        'CacheControl': 'max-age=31536000',
    }

class S3MediaStorage(S3Boto3Storage):
    location = 'media'
    file_overwrite = True
