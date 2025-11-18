interface AbilitiesManagerProps {
  abilities?: unknown[];
  skills?: unknown[];
  canEdit?: boolean;
}

export const AbilitiesManager = ({ abilities, skills, canEdit }: AbilitiesManagerProps) => (
  <div data-testid="abilities-manager">
    <div>Abilities: {abilities?.length || 0}</div>
    <div>Skills: {skills?.length || 0}</div>
    <div>Can Edit: {String(canEdit)}</div>
  </div>
);
