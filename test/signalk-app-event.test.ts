import assert from "node:assert/strict";
import sinon from "sinon";
import { createRED, createMockApp } from "./helpers/red-mock.js";
import registerAppEvent from "../signalk-app-event.js";

describe("signalk-app-event", () => {
  let clock;

  beforeEach(() => {
    clock = sinon.useFakeTimers();
  });

  afterEach(() => {
    clock.restore();
  });

  function setup(app) {
    const { RED, registeredTypes } = createRED({}, { globalContext: { app } });
    registerAppEvent(RED);
    const node = {};
    registeredTypes["signalk-app-event"].call(node, {
      id: "n1",
      event: "test-event",
    });
    return { node };
  }

  it("shows embedded-only error status when app is not in global context", () => {
    const { node } = setup(null);

    assert.equal(node.status.callCount, 1);
    assert.equal(node.status.getCall(0).args[0].fill, "red");
  });

  it("sends event payload when the configured event fires on app", () => {
    const app = createMockApp();
    const { node } = setup(app);

    // createMockApp's emit calls through to registered listeners
    app.emit("test-event", { temperature: 42 });

    assert.equal(node.send.callCount, 1);
    assert.deepEqual(node.send.getCall(0).args[0].payload, { temperature: 42 });
  });

  it("does not send for events other than the configured one", () => {
    const app = createMockApp();
    const { node } = setup(app);

    app.emit("other-event", { data: 1 });

    assert.equal(node.send.callCount, 0);
  });

  it("removes the event listener on close so subsequent events are not forwarded", () => {
    const app = createMockApp();
    const { node } = setup(app);

    node._trigger("close");
    app.emit("test-event", { data: "after-close" });

    assert.equal(node.send.callCount, 0);
  });
});
