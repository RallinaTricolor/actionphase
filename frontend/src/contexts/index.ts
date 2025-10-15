/**
 * Unified State Management System - Context Exports
 *
 * This file exports all context providers and hooks for easy importing.
 */

// Auth Context
export { AuthProvider, useAuth } from './AuthContext';

// Game Context
export {
  GameProvider,
  useGameContext,
  useOptionalGameContext,
  type UserGameRole as GameUserRole,
} from './GameContext';
