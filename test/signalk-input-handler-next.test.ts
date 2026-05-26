import assert from "node:assert/strict";
import sinon from "sinon";
import { createRED, createMockApp } from "./helpers/red-mock.js";
import registerInputHandlerNext from "../signalk-input-handler-next.js";

describe("signalk-input-handler-next", () => {
  function setup(app) {
    const { RED, registeredTypes } = createRED({}, { globalContext: { app } });
    registerInputHandlerNext(RED);
    const node = {};
    registeredTypes["signalk-input-handler-next"].call(node, { id: "n1" });
    return { node };
  }

  it("shows embedded-only error when app is not in global context", () => {
    const { node } = setup(null);

    assert.equal(node.status.callCount, 1);
    assert.equal(node.status.getCall(0).args[0].fill, "red");
  });

  it("calls next with a reconstructed delta when msg.topic is set and msg.next is provided", () => {
    const app = createMockApp();
    const { node } = setup(app);
    const next = sinon.stub();

    node._trigger("input", {
      topic: "navigation.speedOverGround",
      payload: 4.5,
      context: "vessels.self",
      $source: "test.src",
      source: { label: "test" },
      timestamp: "2024-01-01T00:00:00.000Z",
      next,
    });

    assert.equal(next.callCount, 1);
    const delta = next.getCall(0).args[0];
    assert.equal(delta.context, "vessels.self");
    assert.equal(delta.updates[0].values[0].path, "navigation.speedOverGround");
    assert.equal(delta.updates[0].values[0].value, 4.5);
    assert.equal(delta.updates[0].$source, "test.src");
  });

  it("does not call next when msg.topic is not set", () => {
    const app = createMockApp();
    const { node } = setup(app);
    const next = sinon.stub();

    node._trigger("input", { payload: { raw: "data" }, next });

    assert.equal(next.callCount, 0);
  });

  it("falls back to flow context for next when msg.next is not set", () => {
    const app = createMockApp();
    const { node } = setup(app);
    const next = sinon.stub();

    // Pre-populate flow context with next callback
    node.context().flow.set("signalk-input-handler.next", next);

    node._trigger("input", {
      topic: "some.path",
      payload: 1,
      context: "vessels.self",
    });

    assert.equal(next.callCount, 1);
  });
});
