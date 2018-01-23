"""
Constants with CSS selector mappings to easily keep track of things on the page
"""

from houseoffun.houseoffun.tests.util import UrlMappings as urls

# General Game Links
GAME_LINK_CLASS = "game-view-link"
GAME_EDIT_LINK_CLASS = "game-edit-link"
GAME_DELETE_LINK_CLASS = "game-delete-link"

# Specific Game Links
SIGNUP_GAME_LINK_ID = "game-view-link-%s" % urls.SIGNUP_GAME_ID
WITHDRAW_GAME_LINK_ID = "game-view-link-%s" % urls.WITHDRAW_GAME_ID
PROCESS_SIGNUPS_GAME_LINK_ID = "game-view-link-%s" % urls.PROCESS_SIGNUPS_GAME_ID
PENDING_GAME_LINK = "game-view-link-%s" % urls.PENDING_GAME_ID

# Game Elements
GAME_STATUS_TEXT_CLASS = "game-status"
GAME_SUBMIT_BUTTON_CLASS = "game-submit-button"
GAME_CONFIRM_DELETE_CLASS = "game-confirm-delete-button"
SIGNUP_BUTTON_CLASS = "signup-button-signup"
WITHDRAW_BUTTON_CLASS = "signup-button-withdraw"
ACCEPT_BUTTON_CLASS = "signup-button-accept"
REJECT_BUTTON_CLASS = "signup-button-reject"
SIGNUP_STATUS_TEXT_CLASS = "signup-status"

# Character Elements
CHARACTER_LINK_CLASS = "character-link"
CHARACTER_ATTRIBUTES_ID = "character-attributes"
EDIT_CHARACTER_LINK_ID = "character-edit-link"
CHARACTER_SUBMIT_BUTTON_CLASS = "character-submit-button"
CHARACTER_REVIEW_BUTTON_ID = "character-review-button"
