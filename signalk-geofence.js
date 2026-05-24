import geodist from "geodist";
import coreDebug from "debug";
const debug = coreDebug("node-red-contrib-signalk:signalk-geofence");

export default function (RED) {
  function signalk(config) {
    RED.nodes.createNode(this, config);
    var node = this;

    const server = RED.nodes.getNode(config.server);

    if (!server) {
      node.status({
        fill: "red",
        shape: "dot",
        text: "missing server configuration",
      });
      return;
    }

    const context = node.context();

    node.on("input", (msg) => {
      if (msg.payload.latitude) {
        context.latitude = msg.payload.latitude;
        context.longitude = msg.payload.longitude;
      }
      if (msg.payload.distance) {
        context.distance = msg.payload.distance;
      }
    });

    const on_delta = (delta) => {
      let pos = delta.updates[0].values[0];

      if (!pos.value || !pos.value.latitude || !pos.value.longitude) {
        node.status({ fill: "red", shape: "dot", text: "no position" });
        return;
      }

      if (config.myposition && delta.context === "vessels." + server.self) {
        node.myposition = pos.value;
        //debug('updated self position', node.myposition)
        if (config.context !== "vessels.self") {
          return;
        }
      }

      pos = pos.value;

      var fencePos = null;
      if (config.myposition) {
        var mypos = node.myposition;
        if (mypos && mypos.latitude && mypos.longitude) {
          fencePos = { lat: mypos.latitude, lon: mypos.longitude };
        }
      } else {
        if (context.latitude) {
          fencePos = { lat: context.latitude, lon: context.longitude };
        } else {
          fencePos = { lat: config.lat, lon: config.lon };
        }
        if (fencePos.lat === 0 && fencePos.lon === 0) {
          return;
        }
      }

      debug("position update", pos, "fence position", fencePos);

      if (fencePos) {
        let dist = geodist(
          fencePos,
          { lat: pos.latitude, lon: pos.longitude },
          { unit: "meters" },
        );
        let status;
        let payload;
        const distance = context.distance ? context.distance : config.distance;
        if (dist > distance) {
          status = { fill: "green", shape: "dot", text: "outside fence" };
          payload = [null, { payload: "outside" }, { payload: "outside" }];
        } else {
          status = { fill: "green", shape: "dot", text: "inside fence" };
          payload = [{ payload: "inside" }, null, { payload: "inside" }];
        }

        let last = node.context().get("lastValue");
        let current = payload[2].payload;
        //console.log(`${last} ${current} ${config.mode}`)
        if (!last && config.mode === "sendChangesIgnore") {
          node.context().set("lastValue", current);
          return;
        } else if (
          !config.mode ||
          config.mode === "sendAll" ||
          !last ||
          last != current
        ) {
          node.context().set("lastValue", current);
          node.status(status);
          node.send(payload);
        }
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
        config.period,
        onStop,
        on_delta,
      );
      if (config.myposition) {
        server.subscribe(
          "vessels.self",
          "navigation.position",
          config.period,
          onStop,
          on_delta,
        );
      }
    };
    server.on("available", onAvailable);

    node.on("close", function () {
      server.removeListener("available", onAvailable);
      onStop.forEach((f) => f());
    });
  }
  RED.nodes.registerType("signalk-geofence", signalk);
}
