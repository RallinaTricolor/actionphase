import random


class TestHelper():
    """
    Contains utility functions that are used across tests
    """

    @classmethod
    def random_string(cls, length):
        return ''.join(random.choice('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ') for i in range(length))