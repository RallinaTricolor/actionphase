// Package characters provides HTTP handlers for character management endpoints.
//
// This package implements the character sheet system for ActionPhase, including:
//   - Character creation (player characters and NPCs)
//   - Character approval workflow (GM approval/rejection)
//   - NPC assignment to audience members
//   - Character data management (modular character sheet system)
//   - Permission-based access control
//
// Key Features:
//   - Modular character data system supporting different character sheet types
//   - Permission system distinguishing between public/private character information
//   - NPC management including GM-to-audience assignment
//   - Character approval workflow for game management
//
// API Endpoints:
//
//	POST   /api/v1/games/{gameId}/characters     - Create character
//	GET    /api/v1/games/{gameId}/characters     - List game characters
//	GET    /api/v1/characters/{id}               - Get character details
//	POST   /api/v1/characters/{id}/approve       - Approve/reject character (GM)
//	POST   /api/v1/characters/{id}/assign        - Assign NPC to user (GM)
//	POST   /api/v1/characters/{id}/data          - Set character data
//	GET    /api/v1/characters/{id}/data          - Get character data
//
// Character Types:
//   - player_character: Characters controlled by game participants
//   - npc_gm: NPCs controlled by the GM
//   - npc_audience: NPCs assigned to audience members for control
//
// Permission Model:
//   - Character owners can edit their character data
//   - GMs can edit any character in their games
//   - Users assigned to NPCs can edit those NPCs
//   - Public character data is visible to all game participants
//   - Private data is only visible to editors and GMs
package characters
