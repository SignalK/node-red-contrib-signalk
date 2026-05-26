import { Client } from "@signalk/client";
import { v4 as uuidv4 } from "uuid";
import coreDebug from "debug";

const embeddedClientId = "sk-embeded-id";
let createEmbeddedClient;

export function getServer(RED, node) {
  let server = RED.nodes.getNode(node.server);
  if (!server) {
    if (node.context().global.get("isSKEmbedded")) {
      server = RED.nodes.getNode(embeddedClientId);
      if (!server) {
        if (createEmbeddedClient) {
          server = createEmbeddedClient();
        }
        if (!server) {
          node.status({
            fill: "red",
            shape: "dot",
            text: "missing embedded server configuration",
          });
          return null;
        }
      }
    } else {
      node.status({
        fill: "red",
        shape: "dot",
        text: "missing server configuration",
      });
      return null;
    }
  }
  return server;
}

function matchesSubscriptionContext(context, deltaContext, selfId) {
  if (context === "vessels.self") {
    return (
      deltaContext === "vessels.self" ||
      (selfId !== undefined && deltaContext === selfId)
    );
  }

  return deltaContext === context;
}

function matchesSubscriptionPath(subscriptionPath, path) {
  if (subscriptionPath === path) {
    return true;
  }

  if (subscriptionPath.endsWith("*")) {
    return path.startsWith(subscriptionPath.slice(0, -1));
  }

  return false;
}

function deltaMatchesSubscription(delta, context, path, selfId) {
  if (
    !delta ||
    !delta.updates ||
    !matchesSubscriptionContext(context, delta.context, selfId)
  ) {
    return false;
  }

  return delta.updates.some((update) => {
    return (
      Array.isArray(update.values) &&
      update.values.some((pathValue) =>
        matchesSubscriptionPath(path, pathValue.path),
      )
    );
  });
}

export default function (RED) {
  function ConfigSignalKClient(config) {
    RED.nodes.createNode(this, config);

    const originalOn = this.on.bind(this);
    const originalRemoveListener = this.removeListener.bind(this);

    if (config.isEmbedded) {
      const app = this.context().global.get("app");
      const smanager = this.context().global.get("subscriptionmanager");

      this.self = app.selfContext;

      this.onError = (node, err) => {
        node.error(err);
        node.status({ fill: "red", shape: "dot", text: err.message });
      };

      this.handleMessage = (node, delta, source) => {
        app.handleMessage(source || "signalk-node-red", delta);
        return Promise.resolve(true);
      };

      this.on = (event, handler) => {
        if (event === "available") {
          handler();
        } else {
          originalOn(event, handler);
        }
      };

      this.removeListener = (event, handler) => {
        if (event !== "available") {
          originalRemoveListener(event, handler);
        }
      };

      this.registerPutHandler = (node, path, handler) => {
        app.registerPutHandler(
          "vessels.self",
          path,
          (context, path, value, cb) => {
            return handler(context, path, value, cb);
          },
        );
      };

      this.unRegisterPutHandler = (_node, _path) => {};

      this.subscribe = (context, path, period, onStop, cb) => {
        const subscription = {
          context: context,
          subscribe: [
            {
              path: path,
              period: period,
            },
          ],
        };

        smanager.subscribe(
          subscription,
          onStop,
          (err) => {
            if (err) {
              this.error(err);
            }
          },
          cb,
        );
      };

      this.putSelfPath = (node, path, value, cb, source) => {
        const resp = app.putSelfPath(
          path,
          value,
          (reply) => {
            if (cb) {
              cb(reply);
            }
          },
          source,
        );
        if (resp && cb) {
          cb(resp);
        }
      };

      this.sendPutResponse = (node, msg, resp) => {
        if (msg.cbInfo) {
          msg.cbInfo(resp);
          return Promise.resolve(true);
        } else {
          node.error("Received put response without cbInfo");
          return Promise.resolve(false);
        }
      };

      this.getSelfPath = (path) => {
        return Promise.resolve(app.getSelfPath(path));
      };
    } else {
      this.hostname = config.hostname;
      this.port = config.port;

      const debug = coreDebug(
        `node-red-contrib-signalk:config-client-${this.hostname}:${this.port}`,
      );

      this.onError = (node, err) => {
        node.error(err);
        node.status({ fill: "red", shape: "dot", text: err.message });
      };

      this.client = new Client({
        hostname: this.hostname,
        port: this.port,
        deltaStreamBehaviour: "none",
        wsKeepaliveInterval: 10,
        reconnect: true,
        rejectUnauthorized: false,
        username: this.credentials.username,
        password: this.credentials.password,
        useTLS: config.useTLS,
        autoConnect: false,
        notifications: false,
      });

      this.client
        .connect()
        .then(() => {
          debug("connected to server, self", this.client.self);
        })
        .catch((err) => {
          debug("connection error:", err);
          this.error("Error connecting to Signal K server: " + err.message);
        });

      this.client.on("connect", () => {
        if (this.credentials.username && this.credentials.password) {
          debug("authenticating...");
          this.client.authenticate(
            this.credentials.username,
            this.credentials.password,
          );
        }
        this.available = true;
        this.emit("available");
      });

      this.client.on("self", (self) => {
        this.self = self;
      });

      debug("created with hostname %s and port %d", this.hostname, this.port);

      this.on("close", (done) => {
        debug("closing connection");
        if (this.client) {
          this.client.close();
        }
        done();
      });

      this.client.on("error", (err) => {
        this.error("error: " + JSON.stringify(err));
      });

      this.send = (node, msg) => {
        return new Promise((resolve, _reject) => {
          if (this.client && this.client.connection) {
            this.client.connection
              .send(msg)
              .then(() => {
                resolve(true);
              })
              .catch((err) => {
                node.error("error sending message: " + err);
                node.status({
                  fill: "red",
                  shape: "dot",
                  text: "error sending message",
                });
                resolve(false);
              });
          } else {
            const msg = "Not connected to Signal K server";
            node.error(msg);
            node.status({ fill: "red", shape: "dot", text: msg });
            resolve(false);
          }
        });
      };

      this.registerPutHandler = (node, path, handler) => {
        if (!this.putHandlers) {
          this.putHandlers = [];
          const onMessage = (msg) => {
            if (msg.put) {
              try {
                msg.put.forEach((pv) => {
                  const handler = this.putHandlers.find(
                    (h) => h.path === pv.path,
                  );
                  if (handler) {
                    debug("received put %j", msg);
                    const result = handler.func(
                      config.context,
                      pv.path,
                      pv.value,
                      msg.requestId,
                    );
                    result.requestId = msg.requestId;
                    debug("sending response %j %j", result, msg.requestId);
                    this.send(handler.node, result);
                  }
                });
              } catch (err) {
                this.error(err);
              }
            }
          };
          this.client.on("message", onMessage);
        }
        this.putHandlers.push({ path, func: handler, node });
      };

      this.unRegisterPutHandler = (node, path) => {
        if (this.putHandlers) {
          this.putHandlers = this.putHandlers.filter(
            (h) => h.path !== path || h.node !== node,
          );
        }
      };

      this.handleMessage = (node, delta, _source) => {
        delta["$source"] = _source || "signalk-node-red";
        return this.send(node, delta);
      };

      this.subscribe = (context, path, period, onStop, cb) => {
        const subscribeItem: any = { path };
        if (period !== undefined) {
          subscribeItem.period = period;
        }
        const subscription = {
          context,
          subscribe: [subscribeItem],
        };

        const onDelta = (delta) => {
          if (deltaMatchesSubscription(delta, context, path, this.self)) {
            cb(delta);
          }
        };

        this.client.on("delta", onDelta);
        onStop.push(() => {
          this.client.removeListener("delta", onDelta);
        });

        this.client.subscribe(subscription);
      };

      this.on = (event, handler) => {
        if (event === "available" && this.available) {
          handler();
        }
        originalOn(event, handler);
      };

      const putListeners = {};
      let putResponseHandler = null;

      this.putSelfPath = (node, path, value, cb, _source) => {
        const requestId = uuidv4();

        if (putResponseHandler === null) {
          putResponseHandler = (put) => {
            const cb = putListeners[put.requestId];
            if (cb) {
              cb(put);
              if (put.state === "COMPLETED") {
                delete putListeners[put.requestId];
              }
            }
          };
          this.client.on("message", putResponseHandler);
        }

        putListeners[requestId] = cb;
        const put = {
          requestId,
          context: config.context || "vessels.self",
          put: {
            path,
            value,
            source:
              config.source && config.source.length > 0
                ? config.source
                : undefined,
          },
        };
        try {
          debug("sending put %j", put);
          this.send(node, put);
        } catch (err) {
          this.onError(node, err);
        }
      };

      this.sendPutResponse = (node, msg, resp) => {
        if (msg.cbInfo) {
          resp.requestId = msg.cbInfo;
          return this.send(node, resp);
        } else {
          return Promise.resolve(false);
        }
      };

      this.getSelfPath = (path) => {
        return new Promise((resolve, _reject) => {
          this.client
            .API()
            .then((api) => api.get("/vessels/self/" + path))
            .then(resolve)
            .catch((err) => {
              debug(err);
              resolve(null);
            });
        });
      };
    }
  }

  RED.nodes.registerType("signalk-client", ConfigSignalKClient, {
    credentials: {
      username: { type: "text" },
      password: { type: "password" },
    },
  });

  createEmbeddedClient = () =>
    new ConfigSignalKClient({ id: embeddedClientId, isEmbedded: true });
}
