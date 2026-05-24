import geodist from "geodist";
import coreDebug from "debug";
import { getServer } from "./config-client.js";
const debug = coreDebug("node-red-contrib-signalk:signalk-geofence-switch");

export default function (RED) {
  function signalk(config) {
    RED.nodes.createNode(this, config);
    const node = this;
    const server = getServer(RED, node);

    if (!server) {
      return;
    }
    const context = node.context();

    let currentPosition;
    let selfPosition;

    const onTargetDelta = (delta) => {
      const pos = delta?.updates?.[0]?.values?.[0]?.value;
      if (pos && pos.latitude && pos.longitude) {
        currentPosition = pos;
      }
    };

    const onSelfDelta = (delta) => {
      const pos = delta?.updates?.[0]?.values?.[0]?.value;
      if (pos && pos.latitude && pos.longitude) {
        selfPosition = pos;
      }
    };

    let onStop = [];

    const onAvailable = () => {
      debug(
        "connected, subscribing to navigation.position for %s",
        config.context,
      );
      server.subscribe(
        config.context,
        "navigation.position",
        undefined,
        onStop,
        onTargetDelta,
      );
      if (config.myposition) {
        server.subscribe(
          "vessels.self",
          "navigation.position",
          undefined,
          onStop,
          onSelfDelta,
        );
      }
    };
    server.on("available", onAvailable);

    node.on("input", (msg) => {
      if (msg.topic === "signalk-config" && msg.payload) {
        context.latitude = msg.payload.latitude;
        context.longitude = msg.payload.longitude;
        context.distance = msg.payload.distance;
        return;
      }

      if (
        !currentPosition ||
        !currentPosition.latitude ||
        !currentPosition.longitude
      ) {
        node.status({ fill: "red", shape: "dot", text: "no position" });
        return;
      }

      let fencePos = null;
      if (config.myposition) {
        if (selfPosition && selfPosition.latitude && selfPosition.longitude) {
          fencePos = {
            lat: selfPosition.latitude,
            lon: selfPosition.longitude,
          };
        }
      } else {
        if (msg.latitude && msg.longitude) {
          fencePos = { lat: msg.latitude, lon: msg.longitude };
        } else if (context.latitude && context.longitude) {
          fencePos = { lat: context.latitude, lon: context.longitude };
        } else {
          fencePos = { lat: config.lat, lon: config.lon };
        }

        if (fencePos.lat === 0 && fencePos.lon === 0) {
          node.status({ fill: "red", shape: "dot", text: "no lat/lon" });
          return;
        }
      }

      if (!fencePos) {
        node.status({ fill: "red", shape: "dot", text: "no fence position" });
        return;
      }

      const curPos = {
        lat: currentPosition.latitude,
        lon: currentPosition.longitude,
      };
      const dist = geodist(fencePos, curPos, { unit: "meters" });
      const distance = msg.distance || context.distance || config.distance;

      if (dist > distance) {
        node.status({ fill: "green", shape: "dot", text: "outside fence" });
        node.send([null, msg]);
      } else {
        node.status({ fill: "green", shape: "dot", text: "inside fence" });
        node.send([msg, null]);
      }
    });

    node.on("close", function () {
      server.removeListener("available", onAvailable);
      onStop.forEach((f) => f());
    });
  }

  RED.nodes.registerType("signalk-geofence-switch", signalk);
}
