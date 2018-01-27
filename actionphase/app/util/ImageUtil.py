import os, time
from uuid import uuid4


class ImageUtil:
    @classmethod
    def character_directory_path(cls, instance, filename):
        # Taken from: https://stackoverflow.com/questions/15140942/django-imagefield-change-file-name-on-upload
        # get filename
        if instance.pk:
            filename = '{}'.format(instance.pk)
        else:
            # set filename as random string
            filename = '{}'.format(uuid4().hex)
        if hasattr(instance, 'image_version'):
            instance.image_version = time.time()
        # return the whole path to the file
        return os.path.join('characters', filename)
