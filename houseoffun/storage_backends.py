from storages.backends.s3boto3 import S3Boto3Storage
from django.contrib.staticfiles.storage import CachedFilesMixin
from pipeline.storage import PipelineMixin


class S3PipelineStorage(PipelineMixin, CachedFilesMixin, S3Boto3Storage):
    location = 'static'


class S3MediaStorage(S3Boto3Storage):
    location = 'media'
