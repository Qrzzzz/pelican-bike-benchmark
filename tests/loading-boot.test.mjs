import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';

import { bootstrapLoadingPoem } from '../site/assets/loadingPoemRuntime.mjs';


function bootHarness({ rootPresent = true, stylesheetPending = false } = {}) {
  let time = 0, id = 0, starts = 0, destroys = 0, ended = 0;
  const tasks = new Map(), listeners = new Map(), classes = new Set();
  const style = { sheet: stylesheetPending ? null : {}, dataset: {} };
  const document = {
    documentElement: { classList: { add: c => classes.add(c), remove: c => classes.delete(c) } },
    querySelector: () => rootPresent ? {} : null,
    querySelectorAll: () => [style],
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type) { listeners.delete(type); },
    dispatchEvent(event) { if (event.type === 'site-loading-finished') ended++; listeners.get(event.type)?.(); }
  };
  function schedule(fn, delay) { tasks.set(++id, { fn, at: time + delay }); return id; }
  const context = vm.createContext({ document, Event, performance: { now: () => time },
    setTimeout: schedule, clearTimeout: timer => tasks.delete(timer),
    requestAnimationFrame: fn => schedule(fn, 16),
    MutationObserver: class { observe() {} disconnect() {} },
    createPlayer: () => ({ start() { starts++; }, destroy() { destroys++; } })
  });
  vm.runInContext(`(${bootstrapLoadingPoem.toString()})([], createPlayer)`, context);
  function tick(ms) {
    const end = time + ms;
    while (true) {
      const next = [...tasks].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > end) break;
      time = next[1].at; tasks.delete(next[0]); next[1].fn();
    }
    time = end;
  }
  return { classes, tasks, listeners, tick, document, style,
    counts: () => ({ starts, destroys, ended }),
    ready: () => document.dispatchEvent(new Event('site-loading-ready')),
    stylesReady() { style.sheet = {}; document.dispatchEvent(new Event('site-loading-style-ready')); }
  };
}

test('fast boot waits 700ms after painted frames and then cleans up once', () => {
  const h = bootHarness();
  assert.equal(h.counts().starts, 1);
  h.ready(); h.tick(731);
  assert.ok(h.classes.has('site-boot-loading'));
  h.tick(1);
  assert.ok(!h.classes.has('site-boot-loading'));
  assert.deepEqual(h.counts(), { starts: 1, destroys: 1, ended: 1 });
  assert.equal(h.tasks.size, 0);
  assert.equal(h.listeners.size, 0);
});

test('boot waits for both the application and full stylesheet without another minimum delay', () => {
  const h = bootHarness({ stylesheetPending: true });
  h.ready(); h.tick(1200);
  assert.ok(h.classes.has('site-boot-loading'));
  h.stylesReady(); h.tick(0);
  assert.equal(h.counts().ended, 1);
  const slowApp = bootHarness();
  slowApp.tick(1200);
  assert.equal(slowApp.counts().ended, 0);
  slowApp.ready(); slowApp.tick(0);
  assert.equal(slowApp.counts().ended, 1);
});

test('broken startup releases SSR and listeners even if no loading root arrived', () => {
  const h = bootHarness({ rootPresent: false });
  h.tick(180000);
  assert.ok(!h.classes.has('site-boot-loading'));
  assert.equal(h.counts().ended, 1);
  assert.equal(h.listeners.size, 0);
});
