import { describe, it, expect } from 'vitest';
import { asPlayerId, asTeamId, makeId, teamIdAt } from './ids';

describe('ids', () => {
  it('casts pass through the string value', () => {
    expect(asPlayerId('p1')).toBe('p1');
    expect(asTeamId('t1')).toBe('t1');
  });
  it('makeId returns unique strings on successive calls', () => {
    const a = makeId(1);
    const b = makeId(1);
    expect(a).not.toEqual(b);
  });
  it('teamIdAt is stable and indexed', () => {
    expect(teamIdAt(0)).toBe('team-0');
    expect(teamIdAt(2)).toBe('team-2');
  });
});
