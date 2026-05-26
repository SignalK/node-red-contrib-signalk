import assert from "node:assert/strict";
import { createRED, createMockServer } from "./helpers/red-mock.js";
import registerPutSuccess from "../signalk-put-success.js";

describe("signalk-put-success", () => {
  let server, node;

  beforeEach(() => {
    server = createMockServer();
    const { RED, registeredTypes } = createRED({ "server-id": server });
    registerPutSuccess(RED);
    node = {};
    registeredTypes["signalk-put-success"].call(node, {
      id: "n1",
      server: "server-id",
    });
  });

  it("calls server.sendPutResponse with COMPLETED/200 by default", () => {
    node._trigger("input", { cbInfo: "cb-123" });

    assert.equal(server.sendPutResponse.callCount, 1);
    const [, msg, resp] = server.sendPutResponse.getCall(0).args;
    assert.equal(resp.state, "COMPLETED");
    assert.equal(resp.statusCode, 200);
  });

  it("uses msg.statusCode when provided", () => {
    node._trigger("input", { cbInfo: "cb-123", statusCode: 201 });

    const [, , resp] = server.sendPutResponse.getCall(0).args;
    assert.equal(resp.statusCode, 201);
  });

  it("includes msg.message in the response", () => {
    node._trigger("input", { cbInfo: "cb-123", message: "done" });

    const [, , resp] = server.sendPutResponse.getCall(0).args;
    assert.equal(resp.message, "done");
  });

  it("passes the original msg to sendPutResponse so cbInfo is available", () => {
    const msg = { cbInfo: "cb-abc" };
    node._trigger("input", msg);

    const [, passedMsg] = server.sendPutResponse.getCall(0).args;
    assert.equal(passedMsg.cbInfo, "cb-abc");
  });
});
