import assert from "node:assert/strict";
import { createRED, createMockServer } from "./helpers/red-mock.js";
import registerSendNotification from "../signalk-send-notification.js";

describe("signalk-send-notification", () => {
  let server, node;

  function setup(config = {}) {
    server = createMockServer();
    const { RED, registeredTypes } = createRED({ "server-id": server });
    registerSendNotification(RED);
    node = {};
    registeredTypes["signalk-send-notification"].call(node, {
      id: "n1",
      server: "server-id",
      path: "my.alarm",
      state: "alarm",
      message: "something happened",
      source: "",
      visual: false,
      sound: false,
      ...config,
    });
    return node;
  }

  it("sends a notification delta with configured path, state, and message", async () => {
    setup();
    node._trigger("input", { payload: null });
    await Promise.resolve();

    assert.equal(server.handleMessage.callCount, 1);
    const delta = server.handleMessage.getCall(0).args[1];
    const pv = delta.updates[0].values[0];
    assert.equal(pv.path, "notifications.my.alarm");
    assert.equal(pv.value.state, "alarm");
    assert.equal(pv.value.message, "something happened");
  });

  it("prepends 'notifications.' when path does not start with it", async () => {
    setup({ path: "engine.overheat" });
    node._trigger("input", { payload: null });
    await Promise.resolve();

    const delta = server.handleMessage.getCall(0).args[1];
    assert.equal(
      delta.updates[0].values[0].path,
      "notifications.engine.overheat",
    );
  });

  it("does not double-prefix paths that already start with 'notifications.'", async () => {
    setup({ path: "notifications.already.prefixed" });
    node._trigger("input", { payload: null });
    await Promise.resolve();

    const delta = server.handleMessage.getCall(0).args[1];
    assert.equal(
      delta.updates[0].values[0].path,
      "notifications.already.prefixed",
    );
  });

  it("overrides state and message from object payload", async () => {
    setup();
    node._trigger("input", {
      payload: { path: "other.alarm", state: "emergency", message: "critical" },
    });
    await Promise.resolve();

    const pv = server.handleMessage.getCall(0).args[1].updates[0].values[0];
    assert.equal(pv.value.state, "emergency");
    assert.equal(pv.value.message, "critical");
  });

  it("includes visual in method array when config.visual is true", async () => {
    setup({ visual: true, sound: false });
    node._trigger("input", { payload: null });
    await Promise.resolve();

    const pv = server.handleMessage.getCall(0).args[1].updates[0].values[0];
    assert(pv.value.method.includes("visual"));
    assert(!pv.value.method.includes("sound"));
  });

  it("includes both visual and sound when both are enabled", async () => {
    setup({ visual: true, sound: true });
    node._trigger("input", { payload: null });
    await Promise.resolve();

    const pv = server.handleMessage.getCall(0).args[1].updates[0].values[0];
    assert(pv.value.method.includes("visual"));
    assert(pv.value.method.includes("sound"));
  });
});
