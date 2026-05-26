import assert from "node:assert/strict";
import sinon from "sinon";
import { createRED, createMockServer } from "./helpers/red-mock.js";
import registerSubscribe from "../signalk-subscribe.js";

describe("signalk-subscribe", () => {
  let server, RED, registeredTypes;

  beforeEach(() => {
    server = createMockServer();
    ({ RED, registeredTypes } = createRED({ "server-id": server }));
    registerSubscribe(RED);
  });

  function makeNode(config) {
    const node = {};
    registeredTypes["signalk-subscribe"].call(node, {
      id: "n1",
      server: "server-id",
      context: "vessels.self",
      ...config,
    });
    return node;
  }

  it("reports error when no path is configured", () => {
    const node = makeNode({ path: "" });
    assert.equal(node.error.callCount, 1);
    assert(node.error.calledWith("no path specified"));
  });

  it("shows missing-server status when server node is not found", () => {
    const { RED: redNoServer, registeredTypes: rt } = createRED();
    registerSubscribe(redNoServer);
    const node = {};
    rt["signalk-subscribe"].call(node, {
      id: "n1",
      server: "missing-id",
      path: "navigation.speedOverGround",
    });
    assert(node.status.calledOnce);
    assert.equal(node.status.getCall(0).args[0].fill, "red");
  });

  it("subscribes to the configured path when available fires", () => {
    const node = makeNode({ path: "navigation.speedOverGround" });
    server.emit("available");
    assert.equal(server.subscribe.callCount, 1);
    const [ctx, path] = server.subscribe.getCall(0).args;
    assert.equal(ctx, "vessels.self");
    assert.equal(path, "navigation.speedOverGround");
  });

  it("sends delta wrapped in payload on receiving update (sendAll mode)", () => {
    const node = makeNode({ path: "navigation.speedOverGround", mode: "sendAll" });
    server.emit("available");

    const onDelta = server.subscribe.getCall(0).args[4];
    const delta = {
      context: server.self,
      updates: [
        {
          $source: "test",
          values: [{ path: "navigation.speedOverGround", value: 3.0 }],
        },
      ],
    };

    onDelta(delta);

    assert.equal(node.send.callCount, 1);
    const msg = node.send.getCall(0).args[0];
    // context normalized from server.self to 'vessels.self'
    assert.equal(msg.payload.context, "vessels.self");
  });

  it("does not send when value is unchanged in sendChanges mode", () => {
    const node = makeNode({ path: "navigation.speedOverGround", mode: "sendChanges" });
    server.emit("available");
    const onDelta = server.subscribe.getCall(0).args[4];

    const delta = {
      context: server.self,
      updates: [
        { $source: "test", values: [{ path: "navigation.speedOverGround", value: 3.0 }] },
      ],
    };

    onDelta(delta); // first — sends
    assert.equal(node.send.callCount, 1);

    onDelta(delta); // same value — should not send again
    assert.equal(node.send.callCount, 1);
  });

  it("ignores first value in sendChangesIgnore mode then sends on change", () => {
    const node = makeNode({ path: "navigation.speedOverGround", mode: "sendChangesIgnore" });
    server.emit("available");
    const onDelta = server.subscribe.getCall(0).args[4];

    const makeDelta = (val) => ({
      context: server.self,
      updates: [{ $source: "test", values: [{ path: "navigation.speedOverGround", value: val }] }],
    });

    onDelta(makeDelta(3.0)); // first — ignored
    assert.equal(node.send.callCount, 0);

    onDelta(makeDelta(3.0)); // same — still ignored
    assert.equal(node.send.callCount, 0);

    onDelta(makeDelta(4.0)); // changed — now sends
    assert.equal(node.send.callCount, 1);
  });

  it("in flatten mode sends individual messages per path", () => {
    const node = makeNode({
      path: "navigation.speedOverGround",
      flatten: true,
    });
    server.emit("available");
    const onDelta = server.subscribe.getCall(0).args[4];

    const delta = {
      context: server.self,
      updates: [
        {
          $source: "test",
          timestamp: "2024-01-01T00:00:00.000Z",
          values: [
            { path: "navigation.speedOverGround", value: 5.0 },
            { path: "navigation.courseOverGroundTrue", value: 1.0 }, // filtered — wrong path
          ],
        },
      ],
    };

    onDelta(delta);

    // Only the matching path should produce output
    assert.equal(node.send.callCount, 1);
    const msg = node.send.getCall(0).args[0];
    assert.equal(msg.topic, "navigation.speedOverGround");
    assert.equal(msg.payload, 5.0);
    assert.equal(msg.context, "vessels.self");
    assert.equal(msg.$source, "test");
  });

  it("filters by source when config.source is set", () => {
    const node = makeNode({ path: "navigation.speedOverGround", source: "wanted.src" });
    server.emit("available");
    const onDelta = server.subscribe.getCall(0).args[4];

    const wrongSource = {
      context: server.self,
      updates: [{ $source: "other.src", values: [{ path: "navigation.speedOverGround", value: 1.0 }] }],
    };
    const rightSource = {
      context: server.self,
      updates: [{ $source: "wanted.src", values: [{ path: "navigation.speedOverGround", value: 2.0 }] }],
    };

    onDelta(wrongSource);
    assert.equal(node.send.callCount, 0);

    onDelta(rightSource);
    assert.equal(node.send.callCount, 1);
  });

  it("cleans up subscription handlers on close", () => {
    const node = makeNode({ path: "navigation.speedOverGround" });
    server.emit("available");

    node._trigger("close");

    // After close, the node should have removed its available listener
    // Verify by re-emitting available — subscribe should not be called again
    const countBefore = server.subscribe.callCount;
    server.emit("available");
    assert.equal(server.subscribe.callCount, countBefore);
  });
});
