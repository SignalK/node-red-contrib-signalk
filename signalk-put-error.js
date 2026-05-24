import coreDebug from "debug";
import { getServer } from "./config-client.js";
const debug = coreDebug("node-red-contrib-signalk:signalk-put-error");

export default function (RED) {
  function SignalK(config) {
    RED.nodes.createNode(this, config);
    var node = this;

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
