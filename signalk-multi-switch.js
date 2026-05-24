import coreDebug from "debug";
const debug = coreDebug("node-red-contrib-signalk:signalk-multi-switch");

const storeName = "skpersist";

export default function (RED) {
  function SignalKMultiSwitch(config) {
    RED.nodes.createNode(this, config);
    const node = this;

    function getOptionWithValue(value) {
      return config.options.find((opt) => opt.value == value);
    }

    function setStatusWithValue(value) {
      const option = getOptionWithValue(value);
      node.status({
        fill: "green",
        shape: "dot",
        text: `value: ${option ? option.title : value}`,
      });
    }

    const server = RED.nodes.getNode(config.server);

    if (!server) {
      node.status({
        fill: "red",
        shape: "dot",
        text: "missing server configuration",
      });
      return;
    }
    const globalContext = node.context().global;

    if (config.options.length === 0) {
      node.error("at least one option must be defined");
      node.status({
        fill: "red",
        shape: "dot",
        text: "at least one option must be defined",
      });
      return;
    } else {
      node.status({});
    }

    let path = config.path;
    if (!path.endsWith(".state")) {
      path += ".state";
    }

    function handlePut(context, path, value, cbInfo) {
      const option = getOptionWithValue(value);
      let resp;
      if (!option) {
        node.error(`invalid value: ${value}`);
        node.status({
          fill: "red",
          shape: "dot",
          text: `invalid value: ${value}`,
        });

        resp = {
          state: "COMPLETED",
          statusCode: 400,
          message: "Invalid value",
        };
      } else {
        globalContext.set(path, option.value, storeName);
        sendUpdate(option.value);
        if (config.pending) {
          node.send({ topic: path, payload: option.value, cbInfo });
          node.status({
            fill: "green",
            shape: "dot",
            text: `pending value ${option.title}`,
          });
          resp = {
            state: "PENDING",
            statusCode: 202,
          };
        } else {
          node.send({ topic: path, payload: option.value });
          node.status({
            fill: "green",
            shape: "dot",
            text: `put received: ${option.title}`,
          });
          resp = {
            state: "COMPLETED",
            statusCode: 200,
          };
        }
      }

      return resp;
    }

    function sendUpdate(value) {
      let delta = {
        updates: [
          {
            values: [
              {
                value,
                path: path,
              },
            ],
          },
        ],
      };
      //debug('sending delta %j', delta)
      server.handleMessage(node, delta);
    }

    let resendInterval;

    const onConnect = () => {
      globalContext.get(path, storeName, (err, value) => {
        let possibleValues = config.options;

        let delta = {
          updates: [
            {
              meta: [
                {
                  value: {
                    displayName: config.displayName,
                    possibleValues: possibleValues,
                    type: "multiple",
                    supportsPut: true,
                  },
                  path: path,
                },
              ],
            },
          ],
        };
        server.handleMessage(node, delta);

        sendUpdate(value !== undefined ? value : config.options[0].value);
        resendInterval = setInterval(() => {
          globalContext.get(path, storeName, (err, value) => {
            value = value !== undefined ? value : config.options[0].value;
            sendUpdate(value);
            setStatusWithValue(value);
          });
        }, 5000);
      });
    };
    server.on("available", onConnect);

    server.registerPutHandler(node, path, handlePut);

    node.on("input", (msg) => {
      const option = getOptionWithValue(msg.payload);
      if (option) {
        globalContext.set(path, option.value, storeName);
        sendUpdate(option.value);
        node.status({
          fill: "green",
          shape: "dot",
          text: `input: ${option.title}`,
        });
        node.send({ topic: path, payload: option.value });
      } else {
        node.error(
          `payload must be one of: ${config.options.map((opt) => opt.value).join(", ")}`,
        );
        node.status({ fill: "red", shape: "dot", text: `invalid input` });
      }
    });

    node.on("close", function () {
      server.unRegisterPutHandler(node, path);
      server.removeListener("available", onConnect);
      if (resendInterval) {
        clearInterval(resendInterval);
      }
    });
  }
  RED.nodes.registerType("signalk-multi-switch", SignalKMultiSwitch);
}
