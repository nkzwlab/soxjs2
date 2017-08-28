import nodeStrophe from "node-strophe";

let Strophe = nodeStrophe.Strophe;

let $pres = Strophe.$pres;
let $iq = Strophe.$iq;

let PUBSUB_NS = "http://jabber.org/protocol/pubsub";

import parseString from "xml2js";

import SoxUtil from "./sox_util";
import XmlUtil from "./xml_util";
import Device from "./device";
import TransducerValue from "./transducer_value";

class SoxConnection {
  constructor(boshService, jid, password) {
    this.boshService = boshService;
    this.jid = jid;
    this.password = password;

    this._rawConn = null;
    this._isConnected = false;
    this._dataCallbacks = {};
    this._metaCallbacks = {};
  }

  _stropheOnRawInput(data) {
    // console.log("<<<<<< input");
    // console.log(data);
  }

  _stropheOnRawOutput(data) {
    // console.log(">>>>>> output");
    // console.log(data);
  }

  _stropheOnConnConnecting() {

  }

  _stropheOnConnConnected() {
    // console.log("connected 1");
    this._rawConn.send($pres().c('priority').t('-1'));
    // console.log("### connected 2");

    // this._rawConn.PubSub.bind(
    //   "xmpp:pubsub:last-published-item",
    //   that._onLastPublishedItemReceived
    // );

    // this._rawConn.PubSub.bind(
    //   "xmpp:pubsub:item-published",
    //   that._onPublishedItemReceived
    // );

    let that = this;

    let pubsubHandler = (ev) => {
      // TODO
      try {
        // console.log('@@@@@ pubsubHandler!');
        // XmlUtil.dumpDom(ev);
        let cb = (data) => {
          // console.log("@@@@@ got data!");
        };
        let data = SoxUtil.parseDataPayload(that, ev, cb);
        // TODO: dispatch
        that.dispatchData(data);
      } catch (ex) {
        console.error(ex);
      }
      return true; // needed to be called every time
    };

    let service = 'pubsub.' + this.getDomain();

    this._rawConn.addHandler(
      pubsubHandler,
      null,
      'message',
      null,
      null,
      service
    );

    this._isConnected = true;
    // console.log("### connected 3");
    if (this._onConnectCallback) {
      // console.log("### connected 3-1");
      this._onConnectCallback();
      // console.log("### connected 3-2");
    }
    // console.log("### connected 4 end");
  }

  _stropheOnConnDisconnecting() {

  }

  _stropheOnConnDisconnected() {
    this._rawConn = null;
    this._isConnected = false;
    if (this._onDisconnectCallback) {
      this._onDisconnectCallback();
    }
  }

  _stropheOnConnFaill() {

  }

  _stropheOnConnectionStatusUpdate(status) {
    // console.log("@@ start of _stropheOnConnectionStatusUpdate");
    if (status === Strophe.Strophe.Status.CONNECTING) {
      // console.log("@@connecting");
      this._stropheOnConnConnecting();
    } else if (status === Strophe.Strophe.Status.CONNFAIL) {
      // console.log("@@connfail");
      this._stropheOnConnFaill();
    } else if (status === Strophe.Strophe.Status.DISCONNECTING) {
      // console.log("@@disconnecting");
      this._stropheOnConnDisconnecting();
    } else if (status === Strophe.Strophe.Status.DISCONNECTED) {
      // console.log("@@disconnected");
      this._stropheOnConnDisconnected();
    } else if (status === Strophe.Strophe.Status.CONNECTED) {
      // console.log("@@connected");
      this._stropheOnConnConnected();
    } else {
      // console.log("@@ UNKNOWN STATUS: " + status);
    }
    // console.log("@@ end of _stropheOnConnectionStatusUpdate");
    return true;
  }

  // _stropheOnLastPublishedItemReceived(obj) {
  //   let node = obj.node;
  //   if (SoxUtil.endsWithMeta(node)) {
  //     this.dispatchMetaPublish(obj);
  //   } else if (SoxUtil.endsWithData(node)) {
  //     this.dispatchDataPublish(obj);
  //   } else {
  //     // FIXME
  //   }
  // }

  // _stropheOnPublishedItemReceived(obj) {
  //   let node = obj.node;
  //   if (SoxUtil.endsWithData(node)) {
  //     this.dispatchDataPublish(obj);
  //   } else {
  //     // FIXME
  //   }
  // }

  // dispatchDataPublish(obj) {
  //   let node = obj.node;
  //   let deviceName = SoxUtil.cutDataSuffix(node);
  //   let deviceListenerTable = this._dataCallbacks[deviceName];
  //   if (deviceListenerTable === undefined) {
  //     return;
  //   }
  //
  //   let deviceToBind = this.bind(deviceName);
  //   let that = this;
  //   let onDataParsed = (data) => {
  //     that._broadcast(deviceListenerTable, data);
  //   };
  //   SoxUtil.parseDataPayload(obj.entry, deviceToBind, onDataParsed);
  //   // this._broadcast(deviceListenerTable, data);
  // }
  dispatchData(data) {
    let deviceName = data.getDevice().getName();
    let dataListenerTable = this._dataCallbacks[deviceName];
    if (dataListenerTable === undefined) {
      return;
    }

    this._broadcast(dataListenerTable, data);
  }

  // dispatchMetaPublish(obj) {
  //   let node = obj.node;
  //   let deviceName = SoxUtil.cutMetaSuffix(node);
  //   let deviceListenerTable = this._metaCallbacks[deviceName];
  //   if (deviceListenerTable === undefined) {
  //     return;
  //   }
  //
  //   let deviceToBind = this.bind(deviceName);
  //   let that = this;
  //   let onMetaParsed = (meta) => {
  //     that._broadcast(deviceListenerTable, meta);
  //   };
  //   SoxUtil.parseMetaPayload(obj.entry, deviceToBind, onMetaParsed);
  //   // let meta = SoxUtil.parseMetaPayload(obj.entry, deviceToBind);
  //   // this._broadcast(deviceListenerTable, meta);
  // }

  getBoshService() {
    return this.boshService;
  }

  getDomain() {
    return Strophe.Strophe.getDomainFromJid(this.getJID());
  }

  getJID() {
    return this.jid;
  }

  getPassword() {
    return this.password;
  }

  connect(callback) {
    let conn = new Strophe.Strophe.Connection(this.getBoshService());
    this._onConnectCallback = callback;
    conn.rawInput = this._stropheOnRawInput;
    conn.rawOutput = this._stropheOnRawOutput;
    this._rawConn = conn;
    let jid = this.getJID();
    let password = this.getPassword();

    // without wrapping call of _stropheOnConnectionStatusUpdate, "this" will be missed inside the func
    let that = this;
    let cb = (status) => { return that._stropheOnConnectionStatusUpdate(status); };
    conn.connect(jid, password, cb);
  }

  disconnect(callback) {
    if (this._rawConn !== null && this.isConnected()) {
      this._onDisconnectCallback = callback;
      this._rawConn.disconnect();
    }
  }

  isConnected() {
    return this._isConnected;
  }

  getStropheConnection() {
    return this._rawConn;
  }

  addListener(device, callback, listenerId) {
    if (listenerId === undefined) {
      listenerId = this._genRandomId();
    }
    this._registerDataListener(device, listenerId, callback);
    return listenerId;
  }

  removeAllListenerForDevice(device) {
    this._dataCallbacks = {};
  }

  removeListener(listenerId) {
    this._removeDataListenerWithId(listenerId);
  }

  fetchMeta(device, callback) {
    try {
      let that = this;
      let listenerId = this._genRandomId();
      let metaNode = device.getMetaNodeName();
      let _callback = (meta) => {
        that._removeMetaListenerWithId(listenerId);
        that._rawConn.PubSub.unsubscribe(metaNode);
        callback(meta);
      }
      this._registerMetaListener(device, listenerId, _callback);
      // this.subscribe(device);
      // this._subNode(device.getMetaNodeName(), device.getDomain(), true);
      // let cb = (iq) => {
      //   console.log("requesting recent item");
      //   let service = "pubsub." + that.getDomain();
      //
      //   // https://xmpp.org/extensions/xep-0060.html#subscriber-retrieve-requestrecent
      //
      //   // <iq type='get'
      //   //     from='francisco@denmark.lit/barracks'
      //   //     to='pubsub.shakespeare.lit'
      //   //     id='items2'>
      //   //   <pubsub xmlns='http://jabber.org/protocol/pubsub'>
      //   //     <items node='princely_musings' max_items='2'/>
      //   //   </pubsub>
      //   // </iq>
      //   let uniqueId = that._rawConn.getUniqueId("pubsub");
      //   let iq2 = $iq({ type: "get", from: that._rawConn.jid, to: service, id: uniqueId })
      //     .c("pubsub", { xmlns: PUBSUB_NS })
      //     .c("items", { node: node, max_items: 1 });
      //   // that._rawConn.
      //   let suc2 = (iq) => {
      //     console.log("recent request success?");
      //
      //   };
      //   let err2 = (iq) => {
      //     console.log("recent request failed?");
      //
      //   };
      //   that._rawConn.sendIQ(iq2, suc2, err2);
      //
      // };
      // this._unsubNode(device.getMetaNodeName(), device.getDomain(), cb);

      let cb = (iq) => {
        // TODO

      };
      this._getSubscription(device.getMetaNodeName(), device.getDomain(), cb);
    } catch(e) {
      console.log(e.stack);
    }
  }

  _getSubscription(node, domain, cb) {

    //   let iq2 = $iq({ type: "get", from: that._rawConn.jid, to: service, id: uniqueId })
    //     .c("pubsub", { xmlns: PUBSUB_NS })
    //     .c("items", { node: node, max_items: 1 });
    // <iq type='get'
    //     from='francisco@denmark.lit/barracks'
    //     to='pubsub.shakespeare.lit'
    //     id='subscriptions1'>
    //   <pubsub xmlns='http://jabber.org/protocol/pubsub'>
    //     <subscriptions/>
    //   </pubsub>
    // </iq>
    let service = "pubsub." + domain;
    let uniqueId = this._rawConn.getUniqueId("pubsub");
    let iq = $iq({ type: "get", from: this._rawConn.jid, to: service, id: uniqueId })
      .c("pubsub", {xmlns: PUBSUB_NS})
      .c("subscriptions");

    let suc = (iq) => {
      // console.log("get sub ok");
      // XmlUtil.dumpDom(iq);
      let converted = XmlUtil.convSubscriptions(iq);
      // console.log("converted ok");
      cb(converted);

    };
    let err = (iq) => {
      // console.log("get sub failed");

    };

    this._rawConn.sendIQ(iq, suc, err);
  }

  bind(deviceName, domain) {
    if (domain === undefined) {
      domain = this.getDomain();
    }

    return new Device(this, deviceName, domain);
  }

  fetchDevices(callback, domain) {
    if (domain === undefined) {
      domain = this.getDomain();
    }
    // https://github.com/strophe/strophejs-plugin-pubsub/blob/master/strophe.pubsub.js#L297
    let jid = this.getJID();
    let service = "pubsub." + domain;
    // let iq = $iq({from: jid, to: service, type:'get'})
    //   .c('query', { xmlns: Strophe.Strophe.NS.DISCO_ITEMS });
    let iq = $iq({ from: jid, to: service, type: "get", id: this._rawConn.getUniqueId("pubsub") }).c(
      'query', { xmlns: Strophe.Strophe.NS.DISCO_ITEMS }
    );

    let that = this;
    let success = (msg) => {

      // DEBUG
      // let s = msg.toString();
      // console.log("@@@@@ inside success of fetchDevices");
      // console.log("typeof(msg)=" + String(typeof(msg)));
      // console.log(JSON.stringify(Object.keys(msg)));
      // // console.log(msg._childNodesList.length);
      // // for (var i = 0; i < msg._childNodesList.length; i++) {
      // //   var cn = msg._childNodesList[i];
      // //   console.log("---child node " + String(i));
      // //   console.log(String(cn));
      // //   console.log(i);
      // //   console.log(JSON.stringify(Object.keys(cn)));
      // // }
      //
      // let query = msg._childNodesList[0];
      // console.log("-----query");
      // let dumpChildInfo = (x, indent) => {
      //   if (!indent) {
      //     indent = 0;
      //   }
      //   var ind = "";
      //   for (var j = 0; j < indent; j++) {
      //     ind = ind + "  ";
      //   }
      //
      //   if (x._childNodesList.length === 0) {
      //     console.log("_localName=" + x._localName + ", _attributes=" + String(Object.keys(x._attributes)));
      //
      //   }
      //
      //   console.log(x._childNodesList.length);
      //   for (var i = 0; i < x._childNodesList.length; i++) {
      //     var cn = x._childNodesList[i];
      //     console.log(ind + "---child node " + String(i));
      //     console.log(ind + String(cn));
      //     console.log(ind + String(i));
      //     console.log(ind + JSON.stringify(Object.keys(cn)));
      //   }
      // }
      // console.log("---item0");
      // dumpChildInfo(query);
      //
      // var item0 = query._childNodesList[0];
      // dumpChildInfo(item0);
      //
      //
      // // console.log("typeof(msg[0])=" + String(typeof(msg[0])));
      // console.log("---toString() result");
      // if (1000 < s.length) {
      //   console.log(s.substring(0, 1000));
      // } else {
      //   console.log(s);
      // }
      // // DEBUG END
      let query = msg._childNodesList[0];
      let items = query._childNodesList;

      let check = {};
      // for (let item of items) {
      for (var i = 0; i < items.length; i++) {
        let item = items[i];
        // console.log("item._attributes=" + Object.keys(item._attributes));
        // let node = item._attributes.node;
        // console.log("node=" + Object.keys(node))
        let node = item._attributes.node._valueForAttrModified;
        // console.log("node=" + node);
        if (SoxUtil.endsWithData(node)) {
          let realNode = SoxUtil.cutDataSuffix(node);
          if (check[realNode] === undefined) {
            check[realNode] = { data: true };
          } else {
            check[realNode].data = true;
          }
        } else if (SoxUtil.endsWithMeta(node)) {
          let realNode = SoxUtil.cutMetaSuffix(node);
          if (check[realNode] === undefined) {
            check[realNode] = { meta: true };
          } else {
            check[realNode].data = true;
          }
        }
      }

      // let deviceNames = [];
      let devices = [];
      for (let deviceName of Object.keys(check)) {
        let c = check[deviceName];
        if (c.data && c.meta) {
          let device = that.bind(deviceName);
          devices.push(device);
          // deviceNames.push(deviceName);
          // deviceNames.push(device);
        }
      }

      callback(devices);

      // for (let dn of deviceNames) {
      //   console.log(dn);
      // }
      // console.log("---- devices = " + deviceNames.length);

      // SoxUtil.extractDevices(that, msg, callback);
    };

    let error = (msg) => {
      // FIXME
      // console.log("@@@@ fetchDevices error: " + msg);
    };

    return this._rawConn.sendIQ(iq.tree(), success, error, undefined);


    // this._rawConn.PubSub.discoverNodes((suc_result) => {
    //   console.log("discoverNodes: successed: " + suc_result);
    //
    // }, (err_result) => {
    //   console.log("disconverNodes: failed" + err_result);
    // });
  }

  fetchSubscriptions(callback) {
    this._rawConn.PubSub.getSubscriptions((subscriptions) => {
      // TODO: Device オブジェクトのリストに加工してcallbackを呼び出す

    });
  }

  subscribe(device) {
    let dataNode = device.getDataNodeName();
    let domain = device.getDomain();
    // let service = "pubsub." + device.getDomain();

    // this._subNode(dataNode, device.getDomain());
    let that = this;

    this.unsubscribe(device, () => {
      // console.log("@@@ unsubscribe callback called");
      let cb = () => {
      };
      that._subNode(dataNode, domain, false, cb);
      // console.log("@@@ _subNode called");
    });
  }

  _subNode(node, domain, requestRecent, callback) {
    // https://github.com/strophe/strophejs-plugin-pubsub/blob/master/strophe.pubsub.js#L297
    // let service = "pubsub." + device.getDomain();
    let that = this;
    let service = "pubsub." + domain;
    // this._rawConn.PubSub.subscribe(dataNode);
    // TODO

    // node list get のときのquery
    // let iq = $iq({ from: jid, to: service, type: "get", id: this._rawConn.getUniqueId("pubsub") }).c(
    //   'query', { xmlns: Strophe.Strophe.NS.DISCO_ITEMS }
    // );

    // http://ggozad.com/strophe.plugins/docs/strophe.pubsub.html
    // console.log("@@@@@@@ raw jid = " + this._rawConn.jid);
    let rawJid = this._rawConn.jid;
    let bareJid = Strophe.Strophe.getBareJidFromJid(this._rawConn.jid);
    let iq = $iq({ to: service, type: "set", id: this._rawConn.getUniqueId("pubsub") })
      .c('pubsub', { xmlns: "http://jabber.org/protocol/pubsub" })
      // .c('subscribe', {node: node, jid: bareJid});
      .c('subscribe', {node: node, jid: rawJid});

    let suc = (iq) => {
      // console.log("subscribe success? node=" + node);

      // https://xmpp.org/extensions/xep-0060.html#subscriber-retrieve-requestrecent

      // <iq type='get'
      //     from='francisco@denmark.lit/barracks'
      //     to='pubsub.shakespeare.lit'
      //     id='items2'>
      //   <pubsub xmlns='http://jabber.org/protocol/pubsub'>
      //     <items node='princely_musings' max_items='2'/>
      //   </pubsub>
      // </iq>
      if (requestRecent) {
        let uniqueId = that._rawConn.getUniqueId("pubsub");
        let iq2 = $iq({ type: "get", from: that._rawConn.jid, to: service, id: uniqueId })
          .c("pubsub", { xmlns: PUBSUB_NS })
          .c("items", { node: node, max_items: 1 });
        // that._rawConn.
        let suc2 = (iq) => {
          // console.log("recent request success?");
          if (callback) {
            callback();
          }
        };
        let err2 = (iq) => {
          // console.log("recent request failed?");

        };
        that._rawConn.sendIQ(iq2, suc2, err2);
      } else {
        callback();
      }
    };
    let err = (iq) => {
      // console.log("subscribe failed?  " + String(iq));
      // XmlUtil.dumpDom(iq);
    };
    this._rawConn.sendIQ(iq, suc, err);

  }

  unsubscribe(device, callback) {
    let dataNode = device.getDataNodeName();
    let domain = device.getDomain();
    let that = this;

    let cb = () => {
      if (callback) {
        callback();
      }
    };

    let myJid = Strophe.Strophe.getBareJidFromJid(this._rawConn.jid);

    this._getSubscription(dataNode, domain, (sub) => {
      // console.log("_getSubscription callback called in unsubscribe");
      if (sub[myJid] === undefined) {
        sub[myJid] = {};
      }
      let subids = sub[myJid][dataNode];
      if (subids === undefined) {
        // console.log("@@@ subids === undefined!");
        cb();
        return;
      }
      // console.log("@@@ subids.length===" + subids.length);
      if (subids.length == 0) {
        that._unsubNode(dataNode, domain, cb);
      } else {
        let delNextFunc = (i) => {
          if (subids.length <= i) {
            return cb;
          }
          return () => {
            that._unsubNode(dataNode, domain, delNextFunc(i+1), subids[i]);
            // console.log("@@@ _unsubNode called for subid=" + subids[i]);
          }
        };

        that._unsubNode(dataNode, domain, delNextFunc(1), subids[0]);
        // console.log("@@@ _unsubNode called for subid=" + subids[0]);
      }
    })
    // this._unsubNode(dataNode, domain, () => {
    //   // TODO
    // });
  }

  _unsubNode(node, domain, callback, subid) {
    let service = "pubsub." + domain;
    // <iq type='set'
    // from='francisco@denmark.lit/barracks'
    // to='pubsub.shakespeare.lit'
    // id='unsub1'>
    //   <pubsub xmlns='http://jabber.org/protocol/pubsub'>
    //      <unsubscribe
    //          node='princely_musings'
    //          jid='francisco@denmark.lit'/>
    //   </pubsub>
    // </iq>
    let bareJid = Strophe.Strophe.getBareJidFromJid(this._rawConn.jid);
    // console.log("_unsubNode: bareJid=" + bareJid);

    let unsubAttrs = { node: node, jid: bareJid };
    if (subid !== undefined) {
      unsubAttrs.subid = subid;
    }

    let iq = $iq({ to: service, type: "set", id: this._rawConn.getUniqueId("pubsub") })
      .c('pubsub', { xmlns: "http://jabber.org/protocol/pubsub" })
      .c('unsubscribe', unsubAttrs);

    let suc = (iq) => {
      // console.log("unsub success");
      if (callback) {
        callback(iq);
      }
    };
    let err = (iq) => {
      // console.log("unsub failed");
      // XmlUtil.dumpDom(iq);
    };
    this._rawConn.sendIQ(iq, suc, err);
  }

  unsubscribeAll() {
    let that = this;
    this.fetchSubscriptions((devices) => {
      for (let device of devices) {
        that.unsubscribe(device);
      }
    });
  }

  createDevice(device, meta) {
    // create "_data" and "_meta" nodes
    let dataNode = device.getDataNodeName();
    this._rawConn.PubSub.createNode(dataNode);
    let metaNode = device.getMetaNodeName();
    this._rawConn.PubSub.createNode(metaNode);

    // publish meta data
    let metaXmlString = meta.toXmlString();
    this._rawConn.PubSub.publish(metaNode, [metaXmlString]);
  }

  deleteDevice(device) {
    let dataNode = device.getDataNodeName();
    this._rawConn.PubSub.deleteNode(dataNode);
    let metaNode = device.getMetaNodeName();
    this._rawConn.PubSub.deleteNode(metaNode);
  }

  publish(device, data) {
    let xmlString = data.toXmlString();
    let node = device.getDataNodeName();
    this._rawConn.PubSub.publish(node, [xmlString]);
  }

  _genRandomId() {
    let chars = "abcdef01234567890";
    let nChars = chars.length;
    let len = 128;
    var ret = "";
    for (var i = 0; i < len; i++) {
      let idx = Math.floor(Math.random() * nChars);
      let char = chars.charAt(idx);
      ret = ret + char;
    }
    return ret;
  }

  _registerMetaListener(device, listenerId, callback) {
    this._registerListener(this._metaCallbacks, device, listenerId, callback);
  }

  _registerDataListener(device, listenerId, callback) {
    this._registerListener(this._dataCallbacks, device, listenerId, callback);
  }

  _registerListener(table, device, listenerId, callback) {
    let deviceName = device.getName();

    if (table[deviceName] === undefined) {
      table[deviceName] = {};
    }

    table[deviceName][listenerId] = callback;
  }

  _broadcast(table, argument) {
    for (let listenerId of Object.keys(table)) {
      let listener = table[listenerId];
      // console.log('$$$$ listenerId=' + listenerId + ", listener=" + listener);
      listener(argument);
    }
  }

  _removeMetaListenerWithId(listenerId) {
    this._removeListenerWithId(this._metaCallbacks, listenerId);
  }

  _removeDataListenerWithId(listenerId) {
    this._removeListenerWithId(this._dataCallbacks, listenerId);
  }

  _removeListenerWithId(table, listenerId) {
    for (let devName of Object.keys(table)) {
      let devTable = table[devName];
      var found = false;
      for (let lstnId of Object.keys(devTable)) {
        if (lstnId === listenerId) {
          found = true;
          break
        }
      }
      if (found) {
        delete devTable[listenerId];
        break;
      }
    }
  }

}

module.exports = SoxConnection;