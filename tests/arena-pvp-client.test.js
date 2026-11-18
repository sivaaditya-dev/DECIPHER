'use strict';
/**
 * arena-pvp-client.test.js — Unit Tests for modules/arena/pvp-client.js
 * Decipher Language Learning Platform
 */

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const rawCode = fs.readFileSync(
  path.resolve(__dirname, '../modules/arena/pvp-client.js'), 'utf8'
).replace(/^export\s+/gm, '');

const wrappedCode = `(function() {
  ${rawCode}
  return { PvPClient, SSE_BASE, QUEUE_BASE };
})()`;

// Mock EventSource and fetch
class MockEventSource {
  constructor(url) {
    this.url = url;
    this.readyState = 1; // OPEN
    this.closed = false;
    this._listeners = new Map();
    MockEventSource.instances.push(this);
  }
  addEventListener(type, fn) {
    if (!this._listeners.has(type)) this._listeners.set(type, []);
    this._listeners.get(type).push(fn);
  }
  emit(type, payload) {
    const handlers = this._listeners.get(type) || [];
    handlers.forEach(fn => fn({ data: JSON.stringify(payload) }));
  }
  close() {
    this.closed = true;
    this.readyState = 2; // CLOSED
  }
}
MockEventSource.OPEN = 1;
MockEventSource.instances = [];

let fetchCalls = [];
let mockFetchImpl = async () => ({ ok: true, json: async () => ({}) });
const mockFetch = async (url, opts) => {
  fetchCalls.push({ url, opts });
  return mockFetchImpl(url, opts);
};

const sandbox = {
  console,
  Map,
  Set,
  Math,
  JSON,
  encodeURIComponent,
  setTimeout,
  clearTimeout,
  EventSource: MockEventSource,
  fetch: mockFetch,
};
vm.createContext(sandbox);
const { PvPClient } = vm.runInContext(wrappedCode, sandbox);

describe('pvp-client.js — PvPClient', () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    fetchCalls = [];
  });

  test('initializes uid, elo, and displayName', () => {
    const client = new PvPClient('u123', 1350, 'Aditya');
    expect(client.uid).toBe('u123');
    expect(client.elo).toBe(1350);
    expect(client.displayName).toBe('Aditya');
    expect(client.roomCode).toBeNull();
  });

  test('connect opens EventSource to room stream and normalizes code', () => {
    const client = new PvPClient('u1', 1200);
    client.connect('apex');
    expect(client.roomCode).toBe('APEX');
    expect(client.isConnected).toBe(true);
    expect(MockEventSource.instances[0].url).toBe('/api/arena/room/APEX/stream?uid=u1');
    client.disconnect();
  });

  test('dispatches named SSE events to registered listeners', () => {
    const client = new PvPClient('u1', 1200);
    const received = [];
    const handler = (d) => received.push(d);
    client.on('game_state', handler);
    client.connect('ROOM');

    const es = MockEventSource.instances[0];
    es.emit('game_state', { lastWord: 'lucid', hostHp: 90, guestHp: 100 });
    expect(received).toHaveLength(1);
    expect(received[0].lastWord).toBe('lucid');

    client.off('game_state', handler);
    es.emit('game_state', { lastWord: 'dense' });
    expect(received).toHaveLength(1);
    client.disconnect();
  });

  test('sendAction posts normalized word to server', async () => {
    const client = new PvPClient('u1', 1200);
    mockFetchImpl = async () => ({
      ok: true,
      json: async () => ({ success: true, nextStartLetter: 'D' }),
    });

    const notJoined = await client.sendAction('lucid');
    expect(notJoined.ok).toBe(false);

    client.connect('APEX');
    const res = await client.sendAction('  Lucid ', 300);
    expect(res.ok).toBe(true);
    expect(res.nextStartLetter).toBe('D');
    expect(fetchCalls[0].url).toBe('/api/arena/room/APEX/action');
    expect(JSON.parse(fetchCalls[0].opts.body)).toEqual({
      word: 'lucid',
      uid: 'u1',
      weight: 300,
    });
    client.disconnect();
  });

  test('joinQueue opens queue stream when waiting, and connects on match_found', async () => {
    const client = new PvPClient('u1', 1250, 'PlayerOne');
    mockFetchImpl = async () => ({
      ok: true,
      json: async () => ({ queued: true, position: 1 }),
    });

    const foundEvents = [];
    client.on('match_found', d => foundEvents.push(d));

    const res = await client.joinQueue();
    expect(res.ok).toBe(true);
    expect(res.roomCode).toBeNull();
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toContain('/api/arena/queue/stream?uid=u1');

    // Simulate server sending match_found over queue SSE
    MockEventSource.instances[0].emit('match_found', {
      roomCode: 'NX7Q',
      role: 'host',
      opponentName: 'Rival',
      opponentElo: 1280,
    });

    expect(foundEvents).toHaveLength(1);
    expect(client.roomCode).toBe('NX7Q');
    expect(MockEventSource.instances[0].closed).toBe(true); // Queue SSE closed
    expect(MockEventSource.instances[1].url).toBe('/api/arena/room/NX7Q/stream?uid=u1');
    client.disconnect();
  });

  test('joinQueue connects immediately when paired on first POST', async () => {
    const client = new PvPClient('u2', 1220, 'PlayerTwo');
    mockFetchImpl = async () => ({
      ok: true,
      json: async () => ({ roomCode: 'QZ4M', role: 'guest', opponentName: 'PlayerOne', opponentElo: 1250 }),
    });

    const res = await client.joinQueue();
    expect(res.ok).toBe(true);
    expect(res.roomCode).toBe('QZ4M');
    expect(client.roomCode).toBe('QZ4M');
    expect(client.role).toBe('guest');
    client.disconnect();
  });

  test('createPrivateRoom & joinPrivateRoom connect client', async () => {
    const host = new PvPClient('host1', 1400, 'Host');
    mockFetchImpl = async () => ({ ok: true, json: async () => ({ roomCode: 'DUEL', role: 'host' }) });
    const createRes = await host.createPrivateRoom();
    expect(createRes.ok).toBe(true);
    expect(host.roomCode).toBe('DUEL');
    host.disconnect();

    const guest = new PvPClient('guest1', 1350, 'Guest');
    mockFetchImpl = async () => ({ ok: true, json: async () => ({ success: true, roomCode: 'DUEL', role: 'guest', opponentName: 'Host' }) });
    const joinRes = await guest.joinPrivateRoom('duel');
    expect(joinRes.ok).toBe(true);
    expect(guest.roomCode).toBe('DUEL');
    guest.disconnect();
  });

  test('disconnect closes SSE and clears room state', () => {
    const client = new PvPClient('u1', 1200);
    client.connect('ABCD');
    const es = MockEventSource.instances[0];
    client.disconnect();
    expect(es.closed).toBe(true);
    expect(client.roomCode).toBeNull();
    expect(client.isConnected).toBe(false);
  });
});
