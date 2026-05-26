import assert from 'node:assert/strict'
import sinon from 'sinon'
import { createRED, createMockApp } from './helpers/red-mock.js'
import registerSendNmea2000 from '../signalk-send-nmea2000.js'

// Minimal lodash stub — only isObject is used by this node
const lodashStub = { isObject: (v) => v !== null && typeof v === 'object' }

describe('signalk-send-nmea2000', () => {
  let clock

  beforeEach(() => {
    clock = sinon.useFakeTimers()
  })

  afterEach(() => {
    clock.restore()
  })

  function setup(app) {
    const { RED, registeredTypes } = createRED(
      {},
      { globalContext: { app, lodash: lodashStub } }
    )
    registerSendNmea2000(RED)
    const node = {}
    registeredTypes['signalk-send-nmea2000'].call(node, {
      id: 'n1',
      nmea2000JsonEvent: 'nmea2000JsonEvent',
      nmea2000Event: 'nmea2000Event'
    })
    return { node }
  }

  it('shows embedded-only error when app is not in global context', () => {
    const { node } = setup(null)

    assert.equal(node.status.callCount, 1)
    assert.equal(node.status.getCall(0).args[0].fill, 'red')
  })

  it('emits to nmea2000JsonEvent when payload is an object', () => {
    const app = createMockApp()
    const { node } = setup(app)
    const pgn = { pgn: 129025, fields: { latitude: 37.0 } }

    node._trigger('input', { payload: pgn })

    assert(app.emit.calledWith('nmea2000JsonEvent', pgn))
    assert(!app.emit.calledWith('nmea2000Event', pgn))
  })

  it('emits to nmea2000Event when payload is not an object (raw)', () => {
    const app = createMockApp()
    const { node } = setup(app)
    const raw = '09F10100,FF,FF,FF,FF,FF,FF,FF,FF'

    node._trigger('input', { payload: raw })

    assert(app.emit.calledWith('nmea2000Event', raw))
    assert(!app.emit.calledWith('nmea2000JsonEvent', raw))
  })
})
