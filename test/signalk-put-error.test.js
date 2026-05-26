import assert from "node:assert/strict";
import { createRED, createMockServer } from "./helpers/red-mock.js";
import registerPutError from "../signalk-put-error.js";

describe("signalk-put-error", () => {
  let server, node;

  beforeEach(() => {
    server = createMockServer();
    const { RED, registeredTypes } = createRED({ "server-id": server });
    registerPutError(RED);
    node = {};
    registeredTypes["signalk-put-error"].call(node, {
      id: "n1",
      server: "server-id",
    });
  });

  it("calls server.sendPutResponse with COMPLETED/500 by default", () => {
    node._trigger("input", { cbInfo: "cb-123" });

    assert.equal(server.sendPutResponse.callCount, 1);
    const [, msg, resp] = server.sendPutResponse.getCall(0).args;
    assert.equal(resp.state, "COMPLETED");
    assert.equal(resp.statusCode, 500);
  });

  it("uses msg.statusCode when provided", () => {
    node._trigger("input", { cbInfo: "cb-123", statusCode: 403 });

    const [, , resp] = server.sendPutResponse.getCall(0).args;
    assert.equal(resp.statusCode, 403);
  });

  it("includes msg.message in the response", () => {
    node._trigger("input", { cbInfo: "cb-123", message: "permission denied" });

    const [, , resp] = server.sendPutResponse.getCall(0).args;
    assert.equal(resp.message, "permission denied");
  });

  it("passes the original msg to sendPutResponse so cbInfo is available", () => {
    const msg = { cbInfo: "cb-xyz" };
    node._trigger("input", msg);

    const [, passedMsg] = server.sendPutResponse.getCall(0).args;
    assert.equal(passedMsg.cbInfo, "cb-xyz");
  });
});
