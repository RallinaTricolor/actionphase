import os, time
from uuid import uuid4


class ImageUtil:
    @classmethod
    def handle_image_upload(cls, path):
        # Taken from: https://stackoverflow.com/questions/15140942/django-imagefield-change-file-name-on-upload
        def wrapper(instance, filename):
            # get filename
            if instance.pk:
                filename = '{}'.format(instance.pk)
            else:
                # set filename as random string
                filename = '{}'.format(uuid4().hex)
            if hasattr(instance, 'image_version'):
                instance.image_version = time.time()
            # return the whole path to the file
            return os.path.join(path, filename)

        return wrapper