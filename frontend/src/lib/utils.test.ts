import { describe, expect, it } from 'vitest';
import { cn, fmtBytes, fmtMinutes, initials, refId, titleCase } from './utils';

describe('utils', () => {
  it('cn merges class names and skips falsy values', () => {
    expect(cn('a', false && 'b', 'c')).toBe('a c');
  });

  it('titleCase converts snake_case status values', () => {
    expect(titleCase('changes_requested')).toBe('Changes Requested');
    expect(titleCase(null)).toBe('—');
  });

  it('fmtMinutes renders hours and minutes', () => {
    expect(fmtMinutes(0)).toBe('0h');
    expect(fmtMinutes(45)).toBe('45m');
    expect(fmtMinutes(60)).toBe('1h');
    expect(fmtMinutes(135)).toBe('2h 15m');
  });

  it('fmtBytes scales units', () => {
    expect(fmtBytes(512)).toBe('512 B');
    expect(fmtBytes(2048)).toBe('2.0 KB');
    expect(fmtBytes(3 * 1024 * 1024)).toBe('3.0 MB');
  });

  it('initials extracts up to two letters', () => {
    expect(initials('Priya Sharma')).toBe('PS');
    expect(initials('Madonna')).toBe('M');
    expect(initials(undefined)).toBe('?');
  });

  it('refId unwraps populated references', () => {
    expect(refId('abc')).toBe('abc');
    expect(refId({ _id: 'xyz', name: 'X' })).toBe('xyz');
    expect(refId(null)).toBe('');
  });
});
