import { describe, expect, it } from 'vitest';
import { AppController } from './app.controller';

describe('AppController', () => {
  it('exposes a health endpoint', () => {
    const controller = new AppController();
    expect(controller.health()).toEqual({ status: 'ok' });
  });
});
