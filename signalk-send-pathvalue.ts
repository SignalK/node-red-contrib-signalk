import coreDebug from "debug";
import { getServer } from "./config-client.js";
const debug = coreDebug("node-red-contrib-signalk:signalk-send-pathvalue");

export default function (RED) {
  function signalKSendPathValue(config) {
    RED.nodes.createNode(this, config);
    const node = this;

    const sentMeta = {};

    this.server = getServer(RED, node);

    if (!this.server) {
      return;
    }

    function showStatus(text) {
      node.status({ fill: "green", shape: "dot", text: text });
    }

    node.on("input", (msg) => {
      try {
        const path = config.path ? config.path : msg.topic;

        if (!path) {
          node.error("no topic or path configured");
          return;
        }

        if (
          typeof config.meta !== "undefined" &&
          config.meta !== "" &&
          !sentMeta[path]
        ) {
          const delta = {
            updates: [
              {
                meta: [
                  {
                    value: JSON.parse(config.meta),
                    path,
                  },
                ],
              },
            ],
          };

          this.server.handleMessage(
            node,
            delta,
            config.source && config.source.length > 0 ? config.source : null,
          );
          debug("sending meta for path %s with value %j", path, delta);
          sentMeta[path] = true;
        }

        const delta = {
          updates: [
            {
              values: [
                {
                  value: msg.payload,
                  path,
                },
              ],
            },
          ],
        };
        if (config.source && config.source.length > 0) {
          delta.updates[0]["$source"] = config.source;
        }
        const c = path.lastIndexOf(".");
        this.server.handleMessage(node, delta, config.source);
        showStatus(`${path.substring(c + 1)}: ${msg.payload}`);
      } catch (err) {
        this.server.onError(node, err);
      }
    });
  }
  RED.nodes.registerType("signalk-send-pathvalue", signalKSendPathValue);
}
