import assert from 'node:assert/strict'
import sinon from 'sinon'
import { createRED, createMockApp } from './helpers/red-mock.js'
import registerSendNmea0183 from '../dist/signalk-send-nmea0183.js'

describe('signalk-send-nmea0183', () => {
  let clock

  beforeEach(() => {
    clock = sinon.useFakeTimers()
  })

  afterEach(() => {
    clock.restore()
  })

  function setup(app) {
    const { RED, registeredTypes } = createRED({}, { globalContext: { app } })
    registerSendNmea0183(RED)
    const node = {}
    registeredTypes['signalk-send-nmea0183'].call(node, {
      id: 'n1',
      nmea0183Event: 'nmea0183'
    })
    return { node }
  }

  it('shows embedded-only error when app is not in global context', () => {
    const { node } = setup(null)

    assert.equal(node.status.callCount, 1)
    assert.equal(node.status.getCall(0).args[0].fill, 'red')
  })

  it('emits msg.payload to the configured nmea0183Event', () => {
    const app = createMockApp()
    const { node } = setup(app)

    node._trigger('input', { payload: '$GPRMC,...' })

    assert(app.emit.calledWith('nmea0183', '$GPRMC,...'))
  })

  it('emits each sentence to the correct event name', () => {
    const app = createMockApp()
    const { RED, registeredTypes } = createRED({}, { globalContext: { app } })
    registerSendNmea0183(RED)
    const node = {}
    registeredTypes['signalk-send-nmea0183'].call(node, {
      id: 'n2',
      nmea0183Event: 'custom0183'
    })

    node._trigger('input', { payload: '$GPHDT,...' })

    assert(app.emit.calledWith('custom0183', '$GPHDT,...'))
  })
})
