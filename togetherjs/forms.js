/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

define(["jquery", "util", "session", "elementFinder", "eventMaker", "templating", "ot"], function ($, util, session, elementFinder, eventMaker, templating, ot) {
  var forms = util.Module("forms");
  var assert = util.assert;

  // This is how much larger the focus element is than the element it surrounds
  // (this is padding on each side)
  var FOCUS_BUFFER = 5;

  var inRemoteUpdate = false;

  function suppressSync(element) {
    var ignoreForms = TogetherJS.config.get("ignoreForms");
    if (ignoreForms === true) {
      return true;
    }
    else {
      return $(element).is(ignoreForms.join(",")); 
    }
  }

  function maybeChange(event) {
    // Called when we get an event that may or may not indicate a real change
    // (like keyup in a textarea)
    var tag = event.target.tagName;
    if (tag == "TEXTAREA" || tag == "INPUT") {
      change(event);
    }
  }

  function change(event) {
    sendData({
      element: event.target,
      value: getValue(event.target)
    });
  }

  function sendData(attrs) {
    var el = $(attrs.element);
    assert(el);
    var trackerName = attrs.tracker;
    var value = attrs.value;
    if (inRemoteUpdate) {
      return;
    }
    if (elementFinder.ignoreElement(el) ||
        (elementTracked(el) && !trackerName) ||
        suppressSync(el)) {
      return;
    }
    var location = elementFinder.elementLocation(el);
    var msg = {
      type: "form-update",
      element: location
    };
    if (isText(el) || trackerName) {
      var history = getHistory(el);
      if (history) {
        var delta = makeDelta(el, history, value);
        if (delta === null) {
          return; // no change
        }
        assert(delta);
        history.add(delta);
        maybeSendUpdate(el, location, history, trackerName);
        return;
      } else {
        msg.value = value;
        msg.basis = 1;
        setHistory(el, ot.SimpleHistory(session.clientId, value, 1));
      }
    } else {
      msg.value = value;
    }
    session.send(msg);
  }

  function isCheckable(el) {
    el = $(el);
    var type = (el.prop("type") || "text").toLowerCase();
    if (el.prop("tagName") == "INPUT" && ["radio", "checkbox"].indexOf(type) != -1) {
      return true;
    }
    return false;
  }

  var editTrackers = {};
  var liveTrackers = [];

  TogetherJS.addTracker = function (TrackerClass, skipSetInit) {
    assert(typeof TrackerClass === "function", "You must pass in a class");
    assert(typeof TrackerClass.prototype.trackerName === "string",
           "Needs a .prototype.trackerName string");
    // Test for required instance methods.
    "destroy update tracked".split(/ /).forEach(function(m) {
      assert(typeof TrackerClass.prototype[m] === "function",
             "Missing required tracker method: "+m);
    });
    // Test for required class methods.
    "scan tracked".split(/ /).forEach(function(m) {
      assert(typeof TrackerClass[m] === "function",
             "Missing required tracker class method: "+m);
    });
    editTrackers[TrackerClass.prototype.trackerName] = TrackerClass;
    if (!skipSetInit) {
      setInit();
    }
  };

  var AceEditor = util.Class({

    trackerName: "AceEditor",

    constructor: function (el) {
      this.element = $(el)[0];
      assert($(this.element).hasClass("ace_editor"));
      this._change = this._change.bind(this);
      this._editor().document.on("change", this._change);
    },

    tracked: function (el) {
      return this.element === $(el)[0];
    },

    destroy: function (el) {
      this._editor().document.removeListener("change", this._change);
    },

    update: function (msg) {
      this._editor().document.setValue(msg.value);
    },

    _editor: function () {
      return this.element.env;
    },

    _change: function (e) {
      // FIXME: I should have an internal .send() function that automatically
      // asserts !inRemoteUpdate, among other things
      if (inRemoteUpdate) {
        return;
      }
      sendData({
        tracker: this.trackerName,
        element: this.element,
        value: this.getContent()
      });
    },

    getContent: function() {
      return this._editor().document.getValue();
    }
  });

  AceEditor.scan = function () {
    return $(".ace_editor");
  };

  AceEditor.tracked = function (el) {
    return !! $(el).closest(".ace_editor").length;
  };

  TogetherJS.addTracker(AceEditor, true /* skip setInit */);

  var CodeMirrorEditor = util.Class({
    trackerName: "CodeMirrorEditor",

    constructor: function (el) {
      this.element = $(el)[0];
      assert(this.element.CodeMirror);
      this._change = this._change.bind(this);
      this._editor().on("change", this._change);
    },

    tracked: function (el) {
      return this.element === $(el)[0];
    },

    destroy: function (el) {
      this._editor().off("change", this._change);
    },

    update: function (msg) {
      this._editor().setValue(msg.value);
    },

    _change: function (editor, change) {
      if (inRemoteUpdate) {
        return;
      }
      sendData({
        tracker: this.trackerName,
        element: this.element,
        value: this.getContent()
      });
    },

    _editor: function () {
      return this.element.CodeMirror;
    },

    getContent: function() {
      return this._editor().getValue();
    }
  });

  CodeMirrorEditor.scan = function () {
    var result = [];
    var els = document.body.getElementsByTagName("*");
    var _len = els.length;
    for (var i=0; i<_len; i++) {
      var el = els[i];
      if (el.CodeMirror) {
        result.push(el);
      }
    }
    return $(result);
  };

  CodeMirrorEditor.tracked = function (el) {
    el = $(el)[0];
    while (el) {
      if (el.CodeMirror) {
        return true;
      }
      el = el.parentNode;
    }
    return false;
  };

  TogetherJS.addTracker(CodeMirrorEditor, true /* skip setInit */);

  var CKEditor = util.Class({
    trackerName: "CKEditor",

    constructor: function (el) {
      this.element = $(el)[0];
      assert(CKEDITOR);
      assert(CKEDITOR.dom.element.get(this.element));
      this._change = this._change.bind(this);
      // FIXME: change event is available since CKEditor 4.2
      this._editor().on("change", this._change);
    },
    tracked: function (el) {
      return this.element === $(el)[0];
    },
    destroy: function (el) {
      this._editor().removeListener("change", this._change);
    },

    update: function (msg) {
      //FIXME: use setHtml instead of setData to avoid frame reloading overhead
      this._editor().editable().setHtml(msg.value);
    },

    _change: function (e) {
      if (inRemoteUpdate) {
        return;
      }
      sendData({
        tracker: this.trackerName,
        element: this.element,
        value: this.getContent()
      });
    },

    _editor: function () {
      return CKEDITOR.dom.element.get(this.element).getEditor();
    },
    
    getContent: function () {
      return this._editor().getData();
    }
  });

  CKEditor.scan = function () {
    var result = [];
    if (typeof CKEDITOR == "undefined") {
      return;
    }
    var editorInstance;
    for (var instanceIdentifier in CKEDITOR.instances) {
      editorInstance = document.getElementById(instanceIdentifier) || document.getElementsByName(instanceIdentifier)[0];
      if (editorInstance) {
        result.push(editorInstance);
      }
    }
    return $(result);
  };

  CKEditor.tracked = function (el) {
    if (typeof CKEDITOR == "undefined") {
      return false;
    }
    el = $(el)[0];
    return !! (CKEDITOR.dom.element.get(el) && CKEDITOR.dom.element.get(el).getEditor());
  };

  TogetherJS.addTracker(CKEditor, true /* skip setInit */);

  //////////////////// BEGINNING OF TINYMCE ////////////////////////
  var tinymceEditor = util.Class({
    trackerName: "tinymceEditor",

    constructor: function (el) {
      this.element = $(el)[0];
      assert($(this.element).attr('id').indexOf('mce_') != -1);
      this._change = this._change.bind(this);
      this._editor().on("input keyup cut paste change", this._change);
    },

    tracked: function (el) {
      return this.element === $(el)[0];
    },

    destroy: function (el) {
      this._editor().destory();
    },

    update: function (msg) {
      this._editor().setContent(msg.value, {format: 'raw'});
    },

    _change: function (e) {
      if (inRemoteUpdate) {
        return;
      }  
      sendData({
        tracker: this.trackerName,
        element: this.element,
        value: this.getContent()
      });
    },

    _editor: function () {
      if (typeof tinymce == "undefined") {
        return;
      }
      return $(this.element).data("tinyEditor");
    },
    
    getContent: function () {
      return this._editor().getContent();
    }
  });

  tinymceEditor.scan = function () {
    //scan all the elements that contain tinyMCE editors
    if (typeof tinymce == "undefined") {
      return;
    }
    var result = [];
    $(window.tinymce.editors).each(function (i, ed) {
      result.push($('#'+ed.id));
      //its impossible to retrieve a single editor from a container, so lets store it
      $('#'+ed.id).data("tinyEditor", ed);
    });
    return $(result);
  };

  tinymceEditor.tracked = function (el) {
    if (typeof tinymce == "undefined") {
      return false;
    }
    el = $(el)[0];
    return !!$(el).data("tinyEditor");
    /*var flag = false;
    $(window.tinymce.editors).each(function (i, ed) {
      if (el.id == ed.id) {
        flag = true;
      }
    });
    return flag;*/
  };

  TogetherJS.addTracker(tinymceEditor, true);
  ///////////////// END OF TINYMCE ///////////////////////////////////

  function buildTrackers() {
    assert(! liveTrackers.length);
    util.forEachAttr(editTrackers, function (TrackerClass) {
      var els = TrackerClass.scan();
      if (els) {
        $.each(els, function () {
          var tracker = new TrackerClass(this, sendData);
          liveTrackers.push(tracker);
          setHistory($(this), ot.SimpleHistory(session.clientId, getValue(this, tracker), 1), tracker);
        });
      }
    });
  }

  function destroyTrackers() {
    liveTrackers.forEach(function (tracker) {
      tracker.destroy();
    });
    liveTrackers = [];
  }

  function elementTracked(el) {
    var result = false;
    util.forEachAttr(editTrackers, function (TrackerClass) {
      if (TrackerClass.tracked(el)) {
        result = true;
      }
    });
    return result;
  }

  function getTracker(el, name) {
    el = $(el)[0];
    for (var i=0; i<liveTrackers.length; i++) {
      var tracker = liveTrackers[i];
      if (tracker.tracked(el)) {
        //FIXME: assert statement below throws an exception when data is submitted to the hub too fast
        //in other words, name == tracker.trackerName instead of name == tracker when someone types too fast in the tracked editor
        //commenting out this assert statement solves the problem
        assert((! name) || name == tracker.trackerName, "Expected to map to a tracker type", name, "but got", tracker.trackerName);
        return tracker;
      }
    }
    return null;
  }
  function getHistory(el, tracker) {
    tracker = (tracker === undefined) ? getTracker(el) : tracker;
    if (tracker && tracker.getHistory) {
      return tracker.getHistory();
    }
    return el.data('togetherjsHistory');
  }
  function setHistory(el, history, tracker) {
    tracker = (tracker === undefined) ? getTracker(el) : tracker;
    if (tracker && tracker.setHistory) {
      return tracker.setHistory(history);
    }
    return el.data('togetherjsHistory', history);
  }
  function makeDelta(el, history, value, tracker) {
    tracker = (tracker === undefined) ? getTracker(el) : tracker;
    if (tracker && tracker.makeDelta) {
      return tracker.makeDelta(history, value);
    }
    if (history.current == value) {
      return null; /* no change */
    }
    return ot.TextReplace.fromChange(history.current, value);
  }
  function serializeDelta(el, delta, tracker) {
    tracker = (tracker === undefined) ? getTracker(el) : tracker;
    if (tracker && tracker.serializeDelta) {
      return tracker.serializeDelta(delta);
    }
    return {
      start: delta.start,
      del: delta.del,
      text: delta.text
    };
  }
  function parseDelta(el, delta, tracker) {
    tracker = (tracker === undefined) ? getTracker(el) : tracker;
    if (tracker && tracker.parseDelta) {
      return tracker.parseDelta(delta);
    }
    // make a real TextReplace object.
    return ot.TextReplace(delta.start, delta.del, delta.text);
  }
  function serializeInitValue(el, value, tracker) {
    tracker = (tracker === undefined) ? getTracker(el) : tracker;
    if (tracker && tracker.serializeInitValue) {
      return tracker.serializeInitValue(value);
    }
    return value;
  }
  function parseInitValue(el, value, tracker) {
    tracker = (tracker === undefined) ? getTracker(el) : tracker;
    if (tracker && tracker.parseInitValue) {
      return tracker.parseInitValue(value);
    }
    return value;
  }

  var TEXT_TYPES = (
    "color date datetime datetime-local email " +
        "tel text time week").split(/ /g);

  function isText(el) {
    el = $(el);
    var tag = el.prop("tagName");
    var type = (el.prop("type") || "text").toLowerCase();
    if (tag == "TEXTAREA") {
      return true;
    }
    if (tag == "INPUT" && TEXT_TYPES.indexOf(type) != -1) {
      return true;
    }
    return false;
  }

  function getValue(el, tracker) {
    el = $(el);
    tracker = (tracker === undefined) ? getTracker(el) : tracker;
    if (tracker && tracker.getContent) {
      return tracker.getContent();
    } else if (isCheckable(el)) {
      return el.prop("checked");
    } else {
      return el.val();
    }
  }

  function getElementType(el) {
    el = $(el)[0];
    if (el.tagName == "TEXTAREA") {
      return "textarea";
    }
    if (el.tagName == "SELECT") {
      return "select";
    }
    if (el.tagName == "INPUT") {
      return (el.getAttribute("type") || "text").toLowerCase();
    }
    return "?";
  }

  function setValue(el, value) {
    el = $(el);
    var changed = false;
    if (isCheckable(el)) {
      var checked = !! el.prop("checked");
      value = !! value;
      if (checked != value) {
        changed = true;
        el.prop("checked", value);
      }
    } else {
      if (el.val() != value) {
        changed = true;
        el.val(value);
      }
    }
    if (changed) {
      eventMaker.fireChange(el);
    }
  }

  /* Send the top of this history queue, if it hasn't been already sent. */
  function maybeSendUpdate(el, elementPath, history, trackerName) {
    var tracker = trackerName && getTracker(el, trackerName);
    // Use tracker implementation of this method, if available
    if (tracker && tracker.maybeSendUpdate) {
      return tracker.maybeSendUpdate(history);
    }
    var change = history.getNextToSend();
    if (! change) {
      /* nothing to send */
      return;
    }
    var msg = {
      type: "form-update",
      element: elementPath,
      "server-echo": true,
      replace: {
        id: change.id,
        basis: change.basis,
        delta: serializeDelta(el, change.delta, tracker)
      }
    };
    if (trackerName) {
      msg.tracker = trackerName;
    }
    session.send(msg);
  }

  var deferUpdate = [];
  session.hub.on("init-connection", function(msg) {
    // hm, hub reset.  we might never hear our form-init message echoed.
    deferUpdate.length = 0;
  });

  session.hub.on("form-update", function (msg) {
    if (! msg.sameUrl) {
      return;
    }
    var el = $(elementFinder.findElement(msg.element));
    var tracker = null;
    if (msg.tracker) {
      tracker = getTracker(el, msg.tracker);
      assert(tracker);
    }
    var focusedEl = el[0].ownerDocument.activeElement;
    var focusedElSelection;
    if (isText(focusedEl)) {
      focusedElSelection = [focusedEl.selectionStart, focusedEl.selectionEnd];
    }
    var selection;
    if (isText(el)) {
      selection = [el[0].selectionStart, el[0].selectionEnd];
    }
    var value;
    if (msg.replace) {
      var history = getHistory(el, tracker);
      if (!history) {
        console.warn("form update received for uninitialized form element");
        return;
      }
      history.setSelection(selection);
      // apply this change to the history
      msg.replace.delta = parseDelta(el, msg.replace.delta, tracker);
      var changed = history.commit(msg.replace, deferUpdate.length > 0);

      maybeSendUpdate(el, msg.element, history, msg.tracker);
      if (! changed) {
        return;
      }
      value = history.current;
      selection = history.getSelection();
    } else {
      value = msg.value;
    }
    inRemoteUpdate = true;
    try {
      if(tracker) {
        tracker.update({value:value});
      } else {
        setValue(el, value);
      }
      if (isText(el)) {
        el[0].selectionStart = selection[0];
        el[0].selectionEnd = selection[1];
      }
      // return focus to original input:
      if (focusedEl != el[0]) {
        focusedEl.focus();
        if (isText(focusedEl)) {
          focusedEl.selectionStart = focusedElSelection[0];
          focusedEl.selectionEnd = focusedElSelection[1];
        }
      }
    } finally {
      inRemoteUpdate = false;
    }
  });

  var authority = null;

  function compareAuthority(other) {
    // lazy init of our local authority
    if (authority === null) {
      authority = session.timestamp;
    }
    // authorities are two-component timestamp tuples, [seconds, nanoseconds],
    // as returned by process.hrtime() on the hub.
    for (var i=0; i < authority.length; i++) {
      if ( authority[i] !== other[i] ) {
        return authority[i] < other[i] ? -1 : 1;
      }
    }
    return 0;
  }

  function sendInit(clientId, helloId) {
    if ( session.clientId === clientId ) {
      // oh! this was me asking!  nevermind.
      return;
    }

    var msg = {
      type: "form-init",
      "server-echo": true,
      requester: [clientId, helloId],
      authority: authority || session.timestamp,
      updates: []
    };

    // prevent races by deferring updates to the shared state until
    // we've heard this `form-init` message echoed by the hub.
    deferUpdate.push({
      requester: msg.requester,
      authority: msg.authority
    });

    var els = $("textarea, input, select");
    els.each(function () {
      if (elementFinder.ignoreElement(this) || elementTracked(this) ||
          suppressSync(this)) {
        return;
      }
      var el = $(this);
      var value = getValue(el);
      var upd = {
        element: elementFinder.elementLocation(this),
        //elementType: getElementType(el), // added in 5cbb88c9a but unused
        value: value
      };
      if (isText(el)) {
        var history = getHistory(el, null);
        if (history) {
          upd.value = history.committed;
          upd.basis = history.basis;
        }
      }
      msg.updates.push(upd);
    });
    liveTrackers.forEach(function (tracker) {
      var init;
      if ( tracker.makeInit ) {
        // the tracker doesn't want to use our history mechanism.
        init = tracker.makeInit();
      } else {
        init = {
          element: tracker.element,
          tracker: tracker.trackerName
        };
        var el = $(init.element);
        var history = getHistory(el, tracker);
        if (history) {
          init.value = serializeInitValue(el, history.committed, tracker);
          init.basis = history.basis;
        }
      }
      assert(tracker.tracked(init.element));
      init.element = elementFinder.elementLocation($(init.element));
      msg.updates.push(init);
    });
    if (msg.updates.length) {
      session.send(msg);
    }
  }

  function setInit() {
    var els = $("textarea, input, select");
    els.each(function () {
      if (elementTracked(this)) {
        return;
      }
      if (elementFinder.ignoreElement(this)) {
        return;
      }
      var el = $(this);
      var value = getValue(el, null);
      setHistory(el, ot.SimpleHistory(session.clientId, value, 1), null);
    });
    destroyTrackers();
    buildTrackers();
  }

  session.on("reinitialize", setInit);

  session.on("ui-ready", setInit);

  session.on("close", destroyTrackers);

  session.hub.on("form-init", function (msg) {
    if (! msg.sameUrl) {
      return;
    }

    // We need to protect against updates applied to the shared state
    // in the interval between *sending* the `form-init` message and
    // *receiving* the `form-init` message.  Defer updates received in
    // this interval.  Otherwise the peer could init to a state which
    // no longer matched the latest shared state of the other peers.
    if (deferUpdate.length > 0 &&
        deferUpdate[0].requester[0] === msg.requester[0] &&
        deferUpdate[0].requester[1] === msg.requester[1] &&
        compareAuthority(deferUpdate[0].authority) === 0) {
      deferUpdate.shift();
    }

    // The peer which initiates the session never receives a form-init
    // message in response to their hello.  In a 2-peer situation, the
    // second peer gets exactly one form-init in response to hello, so
    // that's fine.  But in a 3+-peer situation more than one client may
    // hello at the same time; we want to ensure that the form-init sent
    // but the not-yet-sync'ed new peer(s) aren't heeded!  (But the new
    // peers don't *know* that they aren't yet sync'ed, they could be
    // session initiators.)

    // Use "session age" as a way to break this tie.  This is a timestamp
    // handed out by the server (so it is not subject to the whims of
    // client-side timekeeping) in the "init-connection" message.

    if ( msg.requester[0] !== session.clientId ) {
      // I'm already sync'ed up, ignore this.
      return;
    }

    if ( compareAuthority( msg.authority ) <= 0 ) {
      // This response is not older than I am!  Ignore it.
      return;
    }
    // we're syncing to the authority of this sender
    authority = msg.authority;

    msg.updates.forEach(function (update) {
      var el;
      try {
        el = elementFinder.findElement(update.element);
      } catch (e) {
        /* skip missing element */
        console.warn(e);
        return;
      }
        inRemoteUpdate = true;
        try {
          var tracker = null;
          if (update.tracker) {
            tracker = getTracker(el, update.tracker);
            assert(tracker);
          }
          if (update.basis) {
            var history = getHistory($(el), tracker);
            // don't overwrite history if we're already up to date
            // (we might have outstanding queued changes we don't want to lose)
            if (!(history && history.basis === update.basis &&
                  // if history.basis is 1, the form could have lingering
                  // edits from before togetherjs was launched.  that's too bad,
                  // we need to erase them to resynchronize with the peer
                  // we just asked to join.
                  history.basis !== 1)) {
              setHistory(
                $(el),
                ot.SimpleHistory(
                  session.clientId,
                  parseInitValue($(el), update.value, tracker),
                  update.basis
                ),
                tracker);
            }
          }
          if(tracker) {
            tracker.update({value: update.value});
          } else {
            setValue(el, update.value);
          }
        } finally {
          inRemoteUpdate = false;
        }
    });
  });

  var lastFocus = null;

  function focus(event) {
    var target = event.target;
    if (elementFinder.ignoreElement(target) || elementTracked(target)) {
      blur(event);
      return;
    }
    if (target != lastFocus) {
      lastFocus = target;
      session.send({type: "form-focus", element: elementFinder.elementLocation(target)});
    }
  }

  function blur(event) {
    var target = event.target;
    if (lastFocus) {
      lastFocus = null;
      session.send({type: "form-focus", element: null});
    }
  }

  var focusElements = {};

  session.hub.on("form-focus", function (msg) {
    if (! msg.sameUrl) {
      return;
    }
    var current = focusElements[msg.peer.id];
    if (current) {
      current.remove();
      current = null;
    }
    if (! msg.element) {
      // A blur
      return;
    }
    var element = elementFinder.findElement(msg.element);
    var el = createFocusElement(msg.peer, element);
    if (el) {
      focusElements[msg.peer.id] = el;
    }
  });

  session.on("prepare-hello", function(msg) {
    // allow us to track form-inits sent in response to this particular
    // hello.
    if (msg.type === 'hello') {
      msg.id = util.generateId();
    }
  });

  session.hub.on("hello", function (msg) {
    if (msg.sameUrl) {
      // the init message is sent atomically with the receipt of the 'hello'
      // so that all peers are guaranteed to send an init with the same shared
      // state.
      sendInit(msg.clientId, msg.id);
      // letting the new peer know about our focus is idempotent,
      // can happen later.
      setTimeout(function() {
        if (lastFocus) {
          session.send({type: "form-focus", element: elementFinder.elementLocation(lastFocus)});
        }
      });
    }
  });

  function createFocusElement(peer, around) {
    around = $(around);
    var aroundOffset = around.offset();
    if (! aroundOffset) {
      console.warn("Could not get offset of element:", around[0]);
      return null;
    }
    var el = templating.sub("focus", {peer: peer});
    el = el.find(".togetherjs-focus");
    el.css({
      top: aroundOffset.top-FOCUS_BUFFER + "px",
      left: aroundOffset.left-FOCUS_BUFFER + "px",
      width: around.outerWidth() + (FOCUS_BUFFER*2) + "px",
      height: around.outerHeight() + (FOCUS_BUFFER*2) + "px"
    });
    $(document.body).append(el);
    return el;
  }

  session.on("ui-ready", function () {
    $(document).on("change", change);
    // note that textInput, keydown, and keypress aren't appropriate events
    // to watch, since they fire *before* the element's value changes.
    $(document).on("input keyup cut paste", maybeChange);
    $(document).on("focusin", focus);
    $(document).on("focusout", blur);
  });

  session.on("close", function () {
    $(document).off("change", change);
    $(document).off("input keyup cut paste", maybeChange);
    $(document).off("focusin", focus);
    $(document).off("focusout", blur);
  });

  return forms;
});
