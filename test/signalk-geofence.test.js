import assert from "node:assert/strict";
import sinon from "sinon";
import { createRED, createMockServer } from "./helpers/red-mock.js";
import registerGeofence from "../signalk-geofence.js";

// Fence: centered at 37.0, -122.0 with 1000m radius
// Inside:  ~142m away
// Outside: ~1420m away
const FENCE_LAT = 37.0;
const FENCE_LON = -122.0;
const FENCE_DISTANCE = 1000;

const INSIDE_POS = { latitude: 37.001, longitude: -122.001 };
const OUTSIDE_POS = { latitude: 37.01, longitude: -122.01 };

function makeDelta(pos) {
  return {
    context: "vessels.self",
    updates: [
      {
        values: [{ path: "navigation.position", value: pos }],
      },
    ],
  };
}

describe("signalk-geofence", () => {
  let server, node, clock;

  beforeEach(() => {
    clock = sinon.useFakeTimers();
    server = createMockServer();
    const { RED, registeredTypes } = createRED({ "server-id": server });
    registerGeofence(RED);
    node = {};
    registeredTypes["signalk-geofence"].call(node, {
      id: "n1",
      server: "server-id",
      context: "vessels.self",
      lat: FENCE_LAT,
      lon: FENCE_LON,
      distance: FENCE_DISTANCE,
      myposition: false,
    });
  });

  afterEach(() => {
    node._trigger("close");
    clock.restore();
  });

  it("subscribes to navigation.position on available", () => {
    server.emit("available");

    assert.equal(server.subscribe.callCount, 1);
    const [ctx, path] = server.subscribe.getCall(0).args;
    assert.equal(ctx, "vessels.self");
    assert.equal(path, "navigation.position");
  });

  it("sends inside message on port 0 when vessel is within fence", () => {
    server.emit("available");
    const onDelta = server.subscribe.getCall(0).args[4];

    onDelta(makeDelta(INSIDE_POS));

    assert.equal(node.send.callCount, 1);
    const [port0, port1] = node.send.getCall(0).args[0];
    assert(port0 !== null, "port 0 should have a message");
    assert.equal(port0.payload, "inside");
    assert.equal(port1, null);
  });

  it("sends outside message on port 1 when vessel is outside fence", () => {
    server.emit("available");
    const onDelta = server.subscribe.getCall(0).args[4];

    onDelta(makeDelta(OUTSIDE_POS));

    assert.equal(node.send.callCount, 1);
    const [port0, port1] = node.send.getCall(0).args[0];
    assert.equal(port0, null);
    assert(port1 !== null, "port 1 should have a message");
    assert.equal(port1.payload, "outside");
  });

  it("overrides fence center when input msg contains latitude/longitude", () => {
    server.emit("available");
    const onDelta = server.subscribe.getCall(0).args[4];

    // Move fence center to be far from OUTSIDE_POS so it becomes inside
    node._trigger("input", {
      payload: { latitude: OUTSIDE_POS.latitude, longitude: OUTSIDE_POS.longitude },
    });

    // Position is exactly at the new fence center — should be inside
    onDelta(makeDelta(OUTSIDE_POS));

    assert.equal(node.send.callCount, 1);
    const [port0] = node.send.getCall(0).args[0];
    assert.equal(port0.payload, "inside");
  });

  it("does not send on first update in sendChangesIgnore mode", () => {
    const { RED, registeredTypes } = createRED({ "server-id": server });
    registerGeofence(RED);
    const n = {};
    registeredTypes["signalk-geofence"].call(n, {
      id: "n2",
      server: "server-id",
      context: "vessels.self",
      lat: FENCE_LAT,
      lon: FENCE_LON,
      distance: FENCE_DISTANCE,
      myposition: false,
      mode: "sendChangesIgnore",
    });

    server.emit("available");
    // server.subscribe was now called twice; take the last callback
    const onDelta = server.subscribe.lastCall.args[4];

    onDelta(makeDelta(INSIDE_POS)); // first call — should be ignored
    assert.equal(n.send.callCount, 0);

    onDelta(makeDelta(OUTSIDE_POS)); // changed — should send
    assert.equal(n.send.callCount, 1);

    n._trigger("close");
  });
});
