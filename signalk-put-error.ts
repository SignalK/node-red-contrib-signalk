import { getServer } from "./config-client.js";

export default function (RED) {
  function SignalK(config) {
    RED.nodes.createNode(this, config);
    const node = this;

    const server = getServer(RED, node);

    if (!server) {
      return;
    }

    node.on("input", (msg) => {
      server.sendPutResponse(node, msg, {
        state: "COMPLETED",
        statusCode: msg.statusCode || 500,
        message: msg.message,
      });
    });
  }
  RED.nodes.registerType("signalk-put-error", SignalK);
}
