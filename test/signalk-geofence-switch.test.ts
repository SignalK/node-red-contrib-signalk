import assert from 'node:assert/strict'
import sinon from 'sinon'
import { createRED, createMockServer } from './helpers/red-mock.js'
import registerGeofenceSwitch from '../signalk-geofence-switch.js'

const FENCE_LAT = 37.0
const FENCE_LON = -122.0
const FENCE_DISTANCE = 1000 // metres

const INSIDE_POS = { latitude: 37.001, longitude: -122.001 } // ~142 m
const OUTSIDE_POS = { latitude: 37.01, longitude: -122.01 } // ~1420 m

function makePositionDelta(pos) {
  return {
    updates: [{ values: [{ path: 'navigation.position', value: pos }] }]
  }
}

describe('signalk-geofence-switch', () => {
  let server, node, clock

  beforeEach(() => {
    clock = sinon.useFakeTimers()
    server = createMockServer()
    const { RED, registeredTypes } = createRED({ 'server-id': server })
    registerGeofenceSwitch(RED)
    node = {}
    registeredTypes['signalk-geofence-switch'].call(node, {
      id: 'n1',
      server: 'server-id',
      context: 'vessels.self',
      lat: FENCE_LAT,
      lon: FENCE_LON,
      distance: FENCE_DISTANCE,
      myposition: false
    })
  })

  afterEach(() => {
    node._trigger('close')
    clock.restore()
  })

  it('subscribes to navigation.position for the configured context on available', () => {
    server.emit('available')

    assert.equal(server.subscribe.callCount, 1)
    const [ctx, path] = server.subscribe.getCall(0).args
    assert.equal(ctx, 'vessels.self')
    assert.equal(path, 'navigation.position')
  })

  it('routes input through port 0 when vessel is inside the fence', () => {
    server.emit('available')
    const onTarget = server.subscribe.getCall(0).args[4]
    onTarget(makePositionDelta(INSIDE_POS))

    node._trigger('input', { payload: 'test' })

    assert.equal(node.send.callCount, 1)
    const [inside, outside] = node.send.getCall(0).args[0]
    assert(inside !== null)
    assert.equal(inside.payload, 'test')
    assert.equal(outside, null)
  })

  it('routes input through port 1 when vessel is outside the fence', () => {
    server.emit('available')
    const onTarget = server.subscribe.getCall(0).args[4]
    onTarget(makePositionDelta(OUTSIDE_POS))

    node._trigger('input', { payload: 'test' })

    assert.equal(node.send.callCount, 1)
    const [inside, outside] = node.send.getCall(0).args[0]
    assert.equal(inside, null)
    assert(outside !== null)
    assert.equal(outside.payload, 'test')
  })

  it('shows no-position error when input arrives before any position update', () => {
    server.emit('available')

    node._trigger('input', { payload: 'test' })

    assert.equal(node.send.callCount, 0)
    assert(node.status.calledOnce)
    assert.equal(node.status.getCall(0).args[0].text, 'no position')
  })

  it('updates fence center via signalk-config input message', () => {
    server.emit('available')
    const onTarget = server.subscribe.getCall(0).args[4]

    // Set vessel to the far position
    onTarget(makePositionDelta(OUTSIDE_POS))

    // Move fence to surround the far position
    node._trigger('input', {
      topic: 'signalk-config',
      payload: {
        latitude: OUTSIDE_POS.latitude,
        longitude: OUTSIDE_POS.longitude,
        distance: FENCE_DISTANCE
      }
    })

    // Vessel is now at the fence center — should be inside
    node._trigger('input', { payload: 'test' })

    const [inside] = node.send.getCall(0).args[0]
    assert.equal(inside.payload, 'test')
  })

  it('overrides fence position from msg.latitude/longitude on input', () => {
    server.emit('available')
    const onTarget = server.subscribe.getCall(0).args[4]
    onTarget(makePositionDelta(OUTSIDE_POS))

    // Pass fence position directly in the message
    node._trigger('input', {
      payload: 'test',
      latitude: OUTSIDE_POS.latitude,
      longitude: OUTSIDE_POS.longitude,
      distance: FENCE_DISTANCE
    })

    const [inside] = node.send.getCall(0).args[0]
    assert.equal(inside.payload, 'test')
  })
})
