import coreDebug from "debug";
import { getServer } from "./config-client.js";
const debug = coreDebug("node-red-contrib-signalk:signalk-send-delta");

export default function (RED) {
  function signalKSendDelta(config) {
    RED.nodes.createNode(this, config);
    var node = this;

    const server = getServer(RED, node);

    if (!server) {
      return;
    }

    let showingStatus = false;
    function showStatus() {
      if (!showingStatus) {
        node.status({ fill: "green", shape: "dot", text: "sent" });
        showingStatus = true;
        setTimeout(() => {
          node.status({});
          showingStatus = false;
        }, 1000);
      }
    }

    node.on("input", (msg) => {
      debug("sending delta %j", msg.payload);
      server.handleMessage(node, msg.payload).then((sent) => {
        if (sent) {
          showStatus();
        }
      });
    });
  }
  RED.nodes.registerType("signalk-send-delta", signalKSendDelta);
}
