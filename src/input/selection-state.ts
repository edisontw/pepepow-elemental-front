import type { EntityID } from '../simulation/components';

export type SelectionMode = 'REPLACE' | 'ADD' | 'TOGGLE';

function normalize(entityIds: Iterable<EntityID>): EntityID[] {
  return [...new Set(entityIds)]
    .filter((entityId) => Number.isSafeInteger(entityId) && entityId > 0)
    .sort((left, right) => left - right);
}

export class SelectionState {
  private readonly selectedIds = new Set<EntityID>();
  private readonly controlGroups = new Map<number, readonly EntityID[]>();

  get ids(): readonly EntityID[] {
    return normalize(this.selectedIds);
  }

  select(entityIds: Iterable<EntityID>, mode: SelectionMode): void {
    const normalized = normalize(entityIds);
    if (mode === 'REPLACE') this.selectedIds.clear();
    for (const entityId of normalized) {
      if (mode === 'TOGGLE' && this.selectedIds.has(entityId)) {
        this.selectedIds.delete(entityId);
      } else {
        this.selectedIds.add(entityId);
      }
    }
  }

  assignControlGroup(slot: number): void {
    this.assertSlot(slot);
    this.controlGroups.set(slot, this.ids);
  }

  recallControlGroup(slot: number, isEligible: (entityId: EntityID) => boolean): boolean {
    this.assertSlot(slot);
    const group = this.controlGroups.get(slot);
    if (!group) return false;
    this.select(group.filter(isEligible), 'REPLACE');
    return true;
  }

  prune(isEligible: (entityId: EntityID) => boolean): boolean {
    let changed = false;
    for (const entityId of this.selectedIds) {
      if (isEligible(entityId)) continue;
      this.selectedIds.delete(entityId);
      changed = true;
    }
    return changed;
  }

  private assertSlot(slot: number): void {
    if (!Number.isInteger(slot) || slot < 0 || slot > 9) {
      throw new Error('Control-group slot must be an integer from 0 to 9.');
    }
  }
}
