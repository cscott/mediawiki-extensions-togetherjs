/*
 * This file is part of the MediaWiki extension TowTruck.
 *
 * TowTruck is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * TowTruck is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with TowTruck.  If not, see <http://www.gnu.org/licenses/>.
 */

(function ( mw, $, TowTruck ) {

	// Get ve instances, without dying if ve is not defined on this page.
	var instances = function() {
		return (window.ve && window.ve.instances) || [];
	};
	// Find the VE Surface associated with the given HTML element.
	var findVE = function(el) {
		var found = null;
		instances().forEach(function(surface) {
			if (surface.$[0] === el && !found) {
				found = surface;
			}
		});
		return found;
	};

	// Our subclass of TowTruck.ot.history
	var makeHistory = function(clientId, initState, initBasis) {
		var history = TowTruck.require("ot").SimpleHistory(
			clientId, initState, initBasis
		);
		// XXX override setSelection, etc?
		return history;
	};

	// Deserialize ve.dm.Transaction objects.
	var parseTransaction = function(json) {
		var ve = window.ve; // be safe w.r.t load order.
		console.assert(!(json instanceof ve.dm.Transaction));
		var tx = new ve.dm.Transaction();
		// leave tx.applied = false!
		tx.operations = json.operations;
		tx.lengthDifference = json.lengthDifference;
		return tx;
	};

	// Document proxy objects.
	var VEDocProxy = function(tracker) {
		this.tracker = tracker;
		this.historyPointer = 0;
		this.queue = null; // linked list
	};
	VEDocProxy.prototype.getQueue = function() {
		var q, result = [];
		for (q = this.queue; q ; q = q.tail) {
			result.push(q.item);
		}
		result.reverse(); // linked lists always end up backwards!
		return result;
	};
	VEDocProxy.prototype.applyToModel = function() {
		var dmSurface = this.tracker.surface.model;
		var history, i;
		// Roll back model state to 'historyPointer'
		// (after this point, all transactions from historyPointer to the
		// end of the complete history should have hasBeenApplied()==false)
		// xxx this is a bit of a hack; ideally it should be upstreamed
		dmSurface.emit('lock');
		history = dmSurface.documentModel.getCompleteHistorySince(
			this.historyPointer);
		for (i = history.length - 1; i >= 0; i--) {
			if (!history[i].transaction.hasBeenApplied()) {
				continue; /* skip undone */
			}
			console.assert(!history[i].undo);
			dmSurface.documentModel.rollback( history[i].transaction );
		}
		dmSurface.purgeHistory(); // clear undo stacks.
		dmSurface.emit( 'unlock' );
		dmSurface.emit( 'history' );
		// now apply the transactions in the queue.
		// XXX selection is lost.
		dmSurface.change(this.getQueue(), new window.ve.Range(0,0));
		// now we're up to date!
		this.historyPointer =
			dmSurface.documentModel.getCompleteHistoryLength();
		this.queue = null;
	};

	// Transaction proxy objects.
	var VETransProxy = function(transaction) {
		console.assert(transaction instanceof window.ve.dm.Transaction);
		this.transaction = transaction;
	};
	VETransProxy.prototype.apply = function(docproxy) {
		var result = new VEDocProxy(docproxy.tracker);
		var dmSurface = docproxy.tracker.surface.model;
		// If this transaction is the next thing in
		// this document's complete history, then just update the history
		// pointer.
		var h =
			dmSurface.documentModel.completeHistory[docproxy.historyPointer];
		if (docproxy.queue === null && h &&
			h.transaction === this.transaction &&
			!h.undo) {
			result.historyPointer = docproxy.historyPointer + 1;
			return result;
		}
		// Otherwise, leave the history pointer alone and add this
		// patch to the queue.
		result.historyPointer = docproxy.historyPointer;
		result.queue = {
			item: this.transaction,
			tail: docproxy.queue
		};
		return result;
	};
	VETransProxy.prototype.transpose = function(transproxy) {
		// XXX deep magic
		console.assert(false, "transpose not implemented");
	};

	// Create a VisualEditor tracker for TowTruck.
	var VETracker = function(el) {
		this.element = (el instanceof $) ? el[0] : el; // real DOM element
		this.surface = findVE(el);
		this.documentModel = this.surface.model.documentModel;

		// Find the Target corresponding to this instance of VE, so we
		// can snarf out the revision ID.  (Pages loaded at different
		// times might have differing revision IDs!)
		var target = null;
		window.ve.init.mw.targets.forEach(function(t) {
			if (t.surface === this.surface) { target = t; }
		}.bind(this));
		this.revid = target ? target.revid : undefined;

		// add change listener
		this.surface.model.on('change', this._change, [], this);

		// create OT history object.
		var clientId = TowTruck.require("session").clientId;
		var docproxy = new VEDocProxy(this);
		docproxy.historyPointer =
			this.documentModel.getCompleteHistoryLength();
		this.history = makeHistory(clientId, docproxy, 1);
	};
	VETracker.prototype.trackerName = "VisualEditor";
	VETracker.prototype.tracked = function(el) {
		return this.element === el;
	};
	VETracker.prototype.destroy = function(el) {
		// remove change listener
		this.surface.model.off('change', this._change);
	};
	VETracker.prototype._change = function() {
		// suppress change event which we're updating the model
		if (this._inRemoteUpdate) { return; }

		// add transactions since most recent current history point.
		// XXX be careful about undone transactions XXX
		var commitPointer = this.history.current.historyPointer;
		this.documentModel.getCompleteHistorySince(commitPointer).
			forEach(function(h) {
				console.assert(!h.undo, "XXX we dont support undo yet");
				this.history.add(new VETransProxy(h.transaction));
			}.bind(this));
		this._maybeSendUpdate();
	};

	VETracker.prototype._maybeSendUpdate = function() {
		var change = this.history.getNextToSend();
		if (!change) { return; /* nothing to send */ }

		// Find a DOM path leading to this instance.
		var elementFinder = TowTruck.require("elementFinder");
		var elementPath = elementFinder.elementLocation(this.element);

		var msg = {
			type: "form-update",
			element: elementPath,
			tracker: this.trackerName,
			revid: this.revid,
			"server-echo": true,
			change: {
				id: change.id,
				basis: change.basis,
				delta: change.delta.transaction
			}
		};
		TowTruck.require("session").send(msg);
	};

	VETracker.prototype.update = function(msg) {
		console.log("VE update");
		// if revid doesn't match, then we can't synchronize this.
		if (msg.revid !== this.revid) { return; }
		// apply this change to the history.
		msg.change.delta = new VETransProxy(parseTransaction(msg.change.delta));
		var changed = this.history.commit(msg.change);
		this._maybeSendUpdate();
		if (!changed) { return; }
		try {
			this._inRemoteUpdate = true;
			this.history.current.applyToModel();
		} finally {
			this._inRemoteUpdate = false;
		}
		// XXX maintain selection, someday.
	};

	// Sync up a newly-started peer with the existing collaborative state.
	VETracker.prototype.init = function(update, msg) {
		var value = update.value;
		// if revid doesn't match, then we can't synchronize this.
		if (value.revid !== this.revid) { return; }
		// if basis matches, we don't need to sync further.
		// (but if this.history.basis == 1, we might have outstanding edits
		// from before we opened towtruck.  That's too bad, we need to wipe
		// them out to resync with the peer we asked to join.)
		if (value.basis === this.history.basis &&
			this.history.basis !== 1) {
			return;
		}
		// ok, roll back document status then run all the transactions.
		var docproxy = new VEDocProxy(this); // clean slate.
		value.transactions.forEach(function(transaction) {
			transaction = new VETransProxy(parseTransaction(transaction));
			docproxy = transaction.apply(docproxy);
		});
		// update our history (clearing our queue in the process, oh well)
		this.history =
			makeHistory(this.history.clientId, docproxy, value.basis);
		// make it so
		try {
			this._inRemoteUpdate = true;
			this.history.current.applyToModel();
		} finally {
			this._inRemoteUpdate = false;
		}
	};

	// Serialize the current state of this visual editor, so
	// that a newly-added peer can be sync'ed up.
	VETracker.prototype.makeInit = function() {

		// Find a DOM path leading to this instance.
		var elementFinder = TowTruck.require("elementFinder");
		var elementPath = elementFinder.elementLocation(this.element);

		// Now get the current state of the editor.  We're going to do
		// this by serializing the "complete history" of the document
		// model, up to the latest 'committed' transaction, skipping
		// over undone transactions.  Applying these transactions in
		// order to a pristine document should recreate matching
		// state.
		var commitPointer = this.history.committed.historyPointer;
		var transactions = this.documentModel.
			getCompleteHistorySince(0).
			slice(0, commitPointer).
			filter(function(history) {
				return history.transaction.hasBeenApplied();
			}).map(function(history) {
				console.assert(!history.undo);
				return history.transaction;
			});

		// okay! Build the init message!
		var value = {
			revid: this.revid,
			basis: this.history.basis,
			transactions: transactions
		};
		return {
			element: elementPath,
			tracker: this.trackerName,
			value: value
		};
	};

	// Find all instances of VE on this page.
	VETracker.scan = function() {
		return instances().map(function(surface, idx) {
			console.assert(surface.$.length === 1);
			// add an ID (helps towtruck find this element)
			surface.$[0].id = "ve-towtruck-" + idx;
			// return the element associated with this Surface
			return surface.$[0];
		});
	};

	// Does the given element correspond to a tracked instance of VE?
	VETracker.tracked = function(el) {
		return instances().some(function(surface) {
			return surface.$[0] === el;
		});
	};

	// Register this tracker with TowTruck
	var registerTracker = function() {
		if (!TowTruck.addTracker) {
			console.warn("Can't register VE tracker, TowTruck is too old");
			return;
		}
		TowTruck.addTracker(VETracker);
	};
	TowTruck.on('ready', registerTracker);
	$( function() { mw.hook( 'towtruck.autostart' ).fire(); } );

}( mediaWiki, jQuery, TowTruck ) );
