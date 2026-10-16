import { expect, test } from 'bun:test';
import { sidebarLine } from '../src/sidebar';

test('shows only the command when there is no highscore', () => {
  expect(sidebarLine(0)).toBe('Claudle Jump  /jump');
});

test('shows the highscore when present', () => {
  expect(sidebarLine(1234)).toBe('Claudle Jump  HI 1234  /jump');
});
