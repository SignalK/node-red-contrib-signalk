import assert from "node:assert/strict";
import sinon from "sinon";
import { createRED } from "./helpers/red-mock.js";
import registerInputHandler from "../signalk-input-handler.js";

describe("signalk-input-handler", () => {
  function makeMockPlugin() {
    return {
      registerDeltaInputHandler: sinon.stub().returns(() => {}),
    };
  }

  function setup(plugin) {
    const { RED, registeredTypes } = createRED(
      {},
      { globalContext: { plugin } },
    );
    registerInputHandler(RED);
    const node = {};
    registeredTypes["signalk-input-handler"].call(node, {
      id: "n1",
      context: "vessels.self",
      path: "navigation.speedOverGround",
      source: undefined,
    });
    return { node };
  }

  it("shows embedded-only error when plugin is not in global context", () => {
    const { node } = setup(null);

    assert.equal(node.status.callCount, 1);
    assert.equal(node.status.getCall(0).args[0].fill, "red");
  });

  it("registers a delta input handler with the configured context and path", () => {
    const plugin = makeMockPlugin();
    setup(plugin);

    assert.equal(plugin.registerDeltaInputHandler.callCount, 1);
    const [ctx, path] = plugin.registerDeltaInputHandler.getCall(0).args;
    assert.equal(ctx, "vessels.self");
    assert.equal(path, "navigation.speedOverGround");
  });

  it("sends the pathValue and stores next in flow context when handler fires", () => {
    const plugin = makeMockPlugin();
    const { node } = setup(plugin);

    const handler = plugin.registerDeltaInputHandler.getCall(0).args[3];
    const nextStub = sinon.stub();
    const pv = { path: "navigation.speedOverGround", value: 3.5 };

    handler(pv, nextStub);

    assert.equal(node.send.callCount, 1);
    const sentMsg = node.send.getCall(0).args[0];
    assert.equal(sentMsg.path, pv.path);
    assert.equal(sentMsg.next, nextStub);
    // flow context should also hold the next callback
    assert.equal(
      node.context().flow.get("signalk-input-handler.next"),
      nextStub,
    );
  });

  it("calls the returned onClose function when the node closes", () => {
    const onClose = sinon.stub();
    const plugin = { registerDeltaInputHandler: sinon.stub().returns(onClose) };
    const { node } = setup(plugin);

    node._trigger("close");

    assert.equal(onClose.callCount, 1);
  });
});
