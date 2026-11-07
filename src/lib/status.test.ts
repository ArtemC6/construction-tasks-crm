import { describe, expect, it } from 'vitest';
import { getAvailableActions } from './status';
import type { TaskStatus } from './types';

const manager = { id: 'manager-1', role: 'manager' as const };
const assignee = { id: 'worker-1', role: 'executor' as const };
const otherWorker = { id: 'worker-2', role: 'executor' as const };

const task = (status: TaskStatus) => ({ status, assignee_id: assignee.id });
const targets = (status: TaskStatus, user: typeof manager | typeof assignee) =>
  getAvailableActions(task(status), user).map((a) => a.to);

describe('getAvailableActions', () => {
  it('назначенный исполнитель ведёт задачу до проверки', () => {
    expect(targets('new', assignee)).toEqual(['in_progress']);
    expect(targets('in_progress', assignee)).toEqual(['review']);
    expect(targets('rework', assignee)).toEqual(['in_progress']);
    expect(targets('review', assignee)).toEqual([]);
    expect(targets('accepted', assignee)).toEqual([]);
  });

  it('постановщик только принимает или возвращает задачу на проверке', () => {
    expect(targets('review', manager)).toEqual(['accepted', 'rework']);
    expect(targets('new', manager)).toEqual([]);
    expect(targets('in_progress', manager)).toEqual([]);
    expect(targets('rework', manager)).toEqual([]);
    expect(targets('accepted', manager)).toEqual([]);
  });

  it('другой исполнитель не получает действий', () => {
    const statuses: TaskStatus[] = ['new', 'in_progress', 'review', 'rework', 'accepted'];
    for (const status of statuses) {
      expect(targets(status, otherWorker)).toEqual([]);
    }
  });

  it('возврат на доработку требует комментарий', () => {
    const actions = getAvailableActions(task('review'), manager);
    expect(actions.find((a) => a.to === 'rework')?.requiresComment).toBe(true);
    expect(actions.find((a) => a.to === 'accepted')?.requiresComment).toBe(false);
  });
});
