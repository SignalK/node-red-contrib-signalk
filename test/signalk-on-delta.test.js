import assert from "node:assert/strict";
import sinon from "sinon";
import { createRED, createMockApp, createMockSignalK } from "./helpers/red-mock.js";
import registerOnDelta from "../signalk-on-delta.js";

describe("signalk-on-delta", () => {
  let clock;

  beforeEach(() => {
    clock = sinon.useFakeTimers();
  });

  afterEach(() => {
    clock.restore();
  });

  const SELF = "vessels.urn:mrn:imo:mmsi:123456789";

  function setup(globalOverrides = {}) {
    const app = createMockApp({ selfContext: SELF });
    const signalk = createMockSignalK();
    const { RED, registeredTypes } = createRED(
      {},
      { globalContext: { app, signalk, ...globalOverrides } },
    );
    registerOnDelta(RED);
    const node = {};
    registeredTypes["signalk-on-delta"].call(node, {
      id: "n1",
      context: "vessels.self",
      flatten: false,
    });
    return { node, app, signalk };
  }

  it("shows embedded-only error when app is not in global context", () => {
    const signalk = createMockSignalK();
    const { RED, registeredTypes } = createRED(
      {},
      { globalContext: { signalk, app: null } },
    );
    registerOnDelta(RED);
    const node = {};
    registeredTypes["signalk-on-delta"].call(node, { id: "n1", context: "vessels.self" });

    assert.equal(node.status.callCount, 1);
    assert.equal(node.status.getCall(0).args[0].fill, "red");
  });

  it("forwards a delta update as msg.payload", () => {
    const { node, signalk } = setup();
    const delta = {
      context: "vessels.self",
      updates: [
        { $source: "other.src", values: [{ path: "navigation.speedOverGround", value: 3.0 }] },
      ],
    };

    signalk.emit("delta", delta);

    assert.equal(node.send.callCount, 1);
    assert.deepEqual(node.send.getCall(0).args[0].payload.updates[0], delta.updates[0]);
  });

  it("accepts deltas whose context matches app.selfContext", () => {
    const { node, signalk } = setup();
    const delta = {
      context: SELF,
      updates: [
        { $source: "other.src", values: [{ path: "navigation.speedOverGround", value: 3.0 }] },
      ],
    };

    signalk.emit("delta", delta);

    assert.equal(node.send.callCount, 1);
    // context should be normalized to 'vessels.self'
    assert.equal(node.send.getCall(0).args[0].payload.context, "vessels.self");
  });

  it("ignores deltas from signalk-node-red source", () => {
    const { node, signalk } = setup();
    const delta = {
      context: "vessels.self",
      updates: [
        { $source: "signalk-node-red", values: [{ path: "some.path", value: 1 }] },
      ],
    };

    signalk.emit("delta", delta);

    assert.equal(node.send.callCount, 0);
  });

  it("ignores deltas whose context does not match", () => {
    const { node, signalk } = setup();
    const delta = {
      context: "vessels.other",
      updates: [
        { $source: "src", values: [{ path: "navigation.speedOverGround", value: 1.0 }] },
      ],
    };

    signalk.emit("delta", delta);

    assert.equal(node.send.callCount, 0);
  });

  it("in flatten mode sends one message per path/value", () => {
    const app = createMockApp({ selfContext: SELF });
    const signalk = createMockSignalK();
    const { RED, registeredTypes } = createRED(
      {},
      { globalContext: { app, signalk } },
    );
    registerOnDelta(RED);
    const node = {};
    registeredTypes["signalk-on-delta"].call(node, {
      id: "n2",
      context: "vessels.self",
      flatten: true,
    });

    const delta = {
      context: "vessels.self",
      updates: [
        {
          $source: "src",
          values: [
            { path: "navigation.speedOverGround", value: 3.0 },
            { path: "navigation.courseOverGroundTrue", value: 1.0 },
          ],
        },
      ],
    };

    signalk.emit("delta", delta);

    assert.equal(node.send.callCount, 2);
  });

  it("removes the delta listener on close", () => {
    const { node, signalk } = setup();

    node._trigger("close");

    const delta = {
      context: "vessels.self",
      updates: [{ $source: "src", values: [{ path: "p", value: 1 }] }],
    };
    signalk.emit("delta", delta);

    assert.equal(node.send.callCount, 0);
  });
});
