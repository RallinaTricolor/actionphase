import React from 'react';

export const InventoryManager = ({ items, currency, canEdit }: any) => (
  <div data-testid="inventory-manager">
    <div>Items: {items?.length || 0}</div>
    <div>Currency: {currency?.length || 0}</div>
    <div>Can Edit: {String(canEdit)}</div>
  </div>
);
