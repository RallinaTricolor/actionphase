#!/bin/bash

# Test creating a game via API
curl -X POST http://localhost:3000/api/v1/games \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer fake-token-for-testing" \
  -d '{
    "title": "The Enchanted Forest Campaign",
    "description": "A mystical adventure through ancient woodlands filled with magic and mystery. Players will encounter various creatures and uncover the secrets of the forest.",
    "genre": "Fantasy",
    "max_players": 6,
    "is_public": true
  }' | jq .

echo -e "\n\nTesting public games endpoint:"
curl -X GET http://localhost:3000/api/v1/games/public | jq .
