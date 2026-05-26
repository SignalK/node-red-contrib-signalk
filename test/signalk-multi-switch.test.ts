import assert from "node:assert/strict";
import sinon from "sinon";
import { createRED, createMockServer } from "./helpers/red-mock.js";
import registerMultiSwitch from "../signalk-multi-switch.js";

const OPTIONS = [
  { title: "Off", value: 0 },
  { title: "Low", value: 1 },
  { title: "High", value: 2 },
];

describe("signalk-multi-switch", () => {
  let server, node, clock;

  function setup(config = {}) {
    server = createMockServer();
    const { RED, registeredTypes } = createRED({ "server-id": server });
    registerMultiSwitch(RED);
    node = {};
    registeredTypes["signalk-multi-switch"].call(node, {
      id: "n1",
      server: "server-id",
      path: "electrical.switches.0",
      options: OPTIONS,
      ...config,
    });
    return node;
  }

  beforeEach(() => {
    clock = sinon.useFakeTimers();
    setup();
  });

  afterEach(() => {
    node._trigger("close");
    clock.restore();
  });

  it("reports error when options array is empty", () => {
    clock.restore();
    clock = sinon.useFakeTimers();
    const { RED, registeredTypes } = createRED({
      "server-id": createMockServer(),
    });
    registerMultiSwitch(RED);
    const n = {};
    registeredTypes["signalk-multi-switch"].call(n, {
      id: "n2",
      server: "server-id",
      path: "some.path",
      options: [],
    });
    assert.equal(n.error.callCount, 1);
    n._trigger("close");
  });

  it("registers a PUT handler for the .state path", () => {
    assert.equal(server.registerPutHandler.callCount, 1);
    const [, path] = server.registerPutHandler.getCall(0).args;
    assert.equal(path, "electrical.switches.0.state");
  });

  it("PUT handler accepts a valid option value and returns COMPLETED/200", () => {
    const handler = server.registerPutHandler.getCall(0).args[2];

    const result = handler(
      "vessels.self",
      "electrical.switches.0.state",
      1,
      "cb-id",
    );

    assert.equal(result.state, "COMPLETED");
    assert.equal(result.statusCode, 200);
    assert.equal(node.send.getCall(0).args[0].payload, 1);
  });

  it("PUT handler rejects invalid value with COMPLETED/400", () => {
    const handler = server.registerPutHandler.getCall(0).args[2];

    const result = handler(
      "vessels.self",
      "electrical.switches.0.state",
      99,
      "cb-id",
    );

    assert.equal(result.state, "COMPLETED");
    assert.equal(result.statusCode, 400);
    assert.equal(node.send.callCount, 0);
    assert.equal(node.error.callCount, 1);
  });

  it("input handler sends valid option value", () => {
    node._trigger("input", { payload: 2 });

    assert.equal(node.send.callCount, 1);
    assert.equal(node.send.getCall(0).args[0].payload, 2);
  });

  it("input handler rejects unknown value", () => {
    node._trigger("input", { payload: 99 });

    assert.equal(node.send.callCount, 0);
    assert.equal(node.error.callCount, 1);
  });

  it("sends meta with possibleValues on available", () => {
    server.emit("available");

    const metaCall = server.handleMessage
      .getCalls()
      .find((c) => c.args[1].updates[0].meta);
    assert(metaCall, "expected a meta delta");
    const meta = metaCall.args[1].updates[0].meta[0];
    assert.equal(meta.value.type, "multiple");
    assert.deepEqual(meta.value.possibleValues, OPTIONS);
  });
});
