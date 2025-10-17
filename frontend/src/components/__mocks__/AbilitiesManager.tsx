import React from 'react';

export const AbilitiesManager = ({ abilities, skills, canEdit }: any) => (
  <div data-testid="abilities-manager">
    <div>Abilities: {abilities?.length || 0}</div>
    <div>Skills: {skills?.length || 0}</div>
    <div>Can Edit: {String(canEdit)}</div>
  </div>
);
