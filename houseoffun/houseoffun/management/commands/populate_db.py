import random
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from houseoffun.houseoffun.models import Plugin, Game, Character, Thread, Comment
from django.shortcuts import get_object_or_404

class Command(BaseCommand):
    args = ''
    help = ''
    
    def handle(self, *args, **options):
        self._create_plugins()
        users = self._create_users()
        games = self._create_games(users)
        characters = self._create_characters(users, games)
        threads = self._create_threads(games)
        self._create_comments(threads, characters)
        print("You ran the command!")

    
    def _create_plugins(self):
        plugin_name = "Threads"
        plugin_description = (
        "Reddit-style comment threads which allow for branching"
        " discussions. Only disable this if you don't want to have public common rooms."
        )
        plugin = Plugin()
        plugin.name = plugin_name
        plugin.description = plugin_description
        plugin.save()

    
    def _create_users(self):
        users = ['admin', 'test']
        # Password is 'houseoffun'
        password = 'pbkdf2_sha256$36000$DHTYuv4Ag5H0$bIQ9OjSImhgEayG0QP//rLk9tWBThBEA84Eo+v0m0B8='
        ret = []
        for user in users:
            user_obj = User()
            user_obj.username = user
            user_obj.first_name = user.title()
            user_obj.last_name = user.title()
            user_obj.password = password
            user_obj.email = user + '@' + user + '.com'
            user_obj.save()
            ret.append(user_obj)
        return ret
    
    def _create_games(self, users):
        games = ['House of Fun', 'Game of Fun', 'Game Academy']
        thread_plugin = get_object_or_404(Plugin, pk = 1)
        ret = []
        for game in games:
            game_obj = Game()
            game_obj.name = game
            game_obj.abbreviation = "".join(i[0] for i in game.split())
            game_obj.description = (game + " ") * 3
            game_obj.game_master = random.choice(users)
            game_obj.save()
            game_obj.plugins.add(thread_plugin)
            ret.append(game_obj)
        return ret
            
    def _create_characters(self, users, games):
        character_names = ['John Smith', 'Bones McKenzie', 'Classic Taka', 'Frank Did Nothing Wrong', 'Secret Zysta']
        ret =[]
        for game in games:
            for user in users:
                character = Character()
                character.name = random.choice(character_names)
                character.owner = user
                character.game = game
                character.save()
                ret.append(character)
        return ret
    
    def _create_threads(self, games):
        threads = ['Day 1', 'Day 2', 'Day 3']
        thread_text = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Praesent molestie sagittis nisl quis aliquam. Phasellus elementum mattis ante, a sagittis risus blandit nec. Ut volutpat orci eu metus fringilla condimentum. Etiam vitae varius sapien, a sagittis dolor. Vestibulum vel quam erat. Integer scelerisque a neque at suscipit. Vestibulum vitae dapibus mi, non auctor erat. Morbi quis erat eleifend, egestas nibh sed, elementum enim. Mauris finibus libero a elit convallis, eu suscipit libero euismod."
        ret = []
        for game in games:
            for thread_title in threads:
                thread = Thread()
                thread.name = thread_title
                thread.game = game
                thread.author = thread.game.game_master
                thread.text = thread_text
                thread.save()
                ret.append(thread)
        return ret
    
    def _create_comments(self, threads, characters):
        comment_text = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Praesent molestie sagittis nisl quis aliquam. Phasellus elementum mattis ante, a sagittis risus blandit nec. Ut volutpat orci eu metus fringilla condimentum. Etiam vitae varius sapien, a sagittis dolor. Vestibulum vel quam erat. Integer scelerisque a neque at suscipit. Vestibulum vitae dapibus mi, non auctor erat. Morbi quis erat eleifend, egestas nibh sed, elementum enim. Mauris finibus libero a elit convallis, eu suscipit libero euismod."
        for thread in threads:
            for character in characters:
                parent = Comment()
                parent.author = character
                parent.thread = thread
                parent.text = comment_text
                parent.save()
                for other_character in characters:
                    child = Comment()
                    child.author = other_character
                    child.thread = thread
                    child.parent = parent
                    child.text = comment_text
                    child.save()