import { canShareSignIn } from './pingBackends';

describe('staged backend migration', () => {
  it.each(['pulsar', 'bazaar'] as const)('blocks handoff between Lidar and cloud-backed %s in both directions', (sibling) => {
    expect(canShareSignIn('lidar', sibling)).toBe(false);
    expect(canShareSignIn(sibling, 'lidar')).toBe(false);
  });

  it('keeps handoff between apps still sharing cloud', () => {
    expect(canShareSignIn('sonar', 'pulsar')).toBe(false);
    expect(canShareSignIn('pulsar', 'bazaar')).toBe(true);
  });

  it('allows the verified local Lidar/Sonar pair in both directions', () => {
    expect(canShareSignIn('lidar', 'sonar')).toBe(true);
    expect(canShareSignIn('sonar', 'lidar')).toBe(true);
  });

  it('never offers the current app as a donor', () => {
    expect(canShareSignIn('lidar', 'lidar')).toBe(false);
  });
});
