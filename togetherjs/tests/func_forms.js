/*global forms, session, ui, windowing, eventMaker */
// =SECTION Setup

$("#fixture").append('<textarea id="textarea" style="width: 10em; height: 3em;"></textarea>');
$("#fixture").append('<br>');
$("#fixture").append('<div><label for="yes"><input type="radio" name="answer" id="yes"> Yes</label><label for="no"><input type="radio" name="answer" id="no"> No</label></div>');
$("#fixture").append('<input type="password" id="password" value="test">');

Test.require("forms", "session", "ui", "windowing", "eventMaker", "templates-en-US");
// => Loaded modules: ...

Test.normalStartup();
// =>...

var fireChange = eventMaker.fireChange;
var $yes = $("#yes");
var $no = $("#no");
var $textarea = $("#textarea");
var $password = $("#password");

windowing.hide("#togetherjs-share");

// =SECTION Changes

Test.waitMessage("form-update");
$yes.prop("checked", true);
fireChange($yes);

/* =>
send: form-update
  clientId: "me",
  element: "#yes",
  value: true
*/

Test.waitMessage("form-update");
$no.prop("checked", true);
fireChange($no);

/* =>
send: form-update
  clientId: "me",
  element: "#no",
  value: true
*/

$password.val("New Password");
fireChange($password);
wait(100);

/* =>
 */

function selection() {
  var start = $textarea[0].selectionStart;
  var end = $textarea[0].selectionEnd;
  if (typeof start != "number") {
    if (typeof end == "number") {
      console.warn("Weird, end with no start", end);
    }
    return 'no selection';
  }
  print('selected', start, '-', end);
}

function select(start, end) {
  if (end === undefined) {
    end = start;
  }
  $textarea[0].selectionStart = start;
  $textarea[0].selectionEnd = end;
}

Test.waitMessage("form-update");
$textarea.val("hello");
fireChange($textarea);

/* =>
send: form-update
  clientId: "me",
  element: "#textarea",
  replace: {
    basis: 1,
    delta: {
      del: 0,
      start: 0,
      text: "hello"
    },
    id: "..."
  },
  "server-echo": true
*/

$textarea.focus();
select(3, 4);
selection();

Test.waitMessage("form-update");
$textarea.val("hello there");
fireChange($textarea);

/* =>
send: form-focus
  clientId: "me",
  element: "#textarea"
selected 3 - 4
send: form-update
  clientId: "me",
  element: "#textarea",
  replace: {
    basis: 2,
    delta: {
      del: 0,
      start: 5,
      text: " there"
    },
    id: "..."
  },
  "server-echo": true
*/

// This doesn't seem to have a reliable result, but I don't know why...
// but I don't think it matters, since the change is only the result of
// $textarea.val()
selection();

Test.waitMessage("form-update");
$textarea.val("hi there");
fireChange($textarea);

/* =>
selected ? - ?
send: form-update
  clientId: "me",
  element: "#textarea",
  replace: {
    basis: 3,
    delta: {
      del: 4,
      start: 1,
      text: "i"
    },
    id: "..."
  },
  "server-echo": true
*/

select(3, 4);

var myAuthority;
Test.viewSend.once("form-init", function(msg) {
  myAuthority = msg.authority;
});
Test.waitMessage("form-focus");
Test.newPeer();
// Note that the client will ignore this update, until it hears
// its own form-init echoed back.  This ensures that the peer
// doesn't initialize to a stale state.
Test.incoming({
  clientId: "faker",
  type: 'form-update',
  element: "#textarea",
  replace: {
    basis: 4,
    delta: {
      start: 1,
      del: 1,
      text: "ey"
    }
  }
});

/* =>

send: hello-back...
send: form-init
  authority: [...],
  clientId: "me",
  requester: [
    "faker",
    "helloid"
  ],
  "server-echo": true,
  updates: [
    {
      basis: 4,
      element: "#textarea",
      value: "hi there"
    },
    {
      element: "#yes",
      value: false
    },
    {
      element: "#no",
      value: true
    }
  ]
send: form-focus...
*/

print($textarea.val());
selection();
print(myAuthority);

/* =>
hi there
selected 3 - 4
[...]
*/

// Now echo back the form-init message, followed by a retransmit of the
// previous update.  This time it will be applied.

Test.incoming({
  clientId: "me",
  type: "form-init",
  requester: ["faker","helloid"],
  authority: myAuthority,
  "sever-echo": true,
  element: "#textarea",
  updates: [
    {
      basis: 4,
      element: "#textarea",
      value: "hi there"
    },
    {
      element: "#yes",
      value: false
    },
    {
      element: "#no",
      value: true
    }
  ]
});
Test.incoming({
  clientId: "faker",
  type: 'form-update',
  element: "#textarea",
  replace: {
    basis: 4,
    delta: {
      start: 1,
      del: 1,
      text: "ey"
    }
  }
});
wait(function() { return $textarea.val()==='hey there'; });

/* =>
 */

print($textarea.val());
selection();

/* =>
hey there
selected 4 - 5
*/

select(0, 5);
Test.incoming({
  clientId: "faker",
  type: 'form-update',
  element: "#textarea",
  replace: {
    basis: 5,
    delta: {
      start: 1, del: 2, text: "ELLO"
    }
  }
});
wait(function() { return $textarea.val()==='hELLO there'; });

// =>

print($textarea.val());
selection();

/* =>
hELLO there
selected 0 - 7
*/

// unsolicited form-init should be ignored...
Test.incoming({
  clientId: "faker",
  type: "form-init",
  requester: "faker",
  authority: [0,0],
  "server-echo": true,
  updates: [
    {
      basis: 6,
      element: "#textarea",
      value: "foo"
    }
  ]
});
wait(100);

// =>

print($textarea.val());

// => hELLO there
