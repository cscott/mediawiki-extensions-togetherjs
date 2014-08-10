/*
 * This file is part of the MediaWiki extension TogetherJS.
 *
 * TogetherJS is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * TogetherJS is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with TogetherJS.  If not, see <http://www.gnu.org/licenses/>.
 */

(function ( mw, $, TogetherJS ) {
	"use strict";

	// Get ve instances, without dying if ve is not defined on this page.
	var instances = function() {
		return (window.ve && window.ve.instances) || [];
	};

	// Find the VE Surface associated with the given HTML element.
	var findVE = function(el) {
		var found = null;
		instances().forEach(function(surface) {
			if (surface.$element[0] === el && !found) {
				found = surface;
			}
		});
		return found;
	};

	// assertion helper
	var assert = function(b, msg) {
		if (!b) { throw new Error('Assertion failure: '+( msg || '' )); }
	};

	/*
	// Our subclass of TogetherJS.ot.history
	var makeHistory = function(clientId, initState, initBasis) {
		var history = TogetherJS.require("ot").SimpleHistory(
			clientId, initState, initBasis
		);
		// XXX override setSelection, etc?
		return history;
	};
	*/

	// ve.copy only does leaf nodes, *plus* it handles ve.Range oddly
	// because ve.Range.clone() exists. Make our own deepcopy function (sigh)
	// while we maybe try to get a fix deployed to oojs upstream.
	// (https://gerrit.wikimedia.org/r/154061)
	var deepcopy = function( obj, callback ) {
		callback = callback || function() {};
		var mapper = function( obj ) {
			var lookaside = callback( obj );
			if ( lookaside !== undefined ) {
				return lookaside;
			}
			if ( Array.isArray( obj ) ) {
				return obj.map( mapper );
			} else if (typeof( obj )==='object') {
				return Object.keys( obj ).reduce( function( nobj, key ) {
					nobj[key] = mapper( obj[key] );
					return nobj;
				}, {} );
			}
			return obj;
		};
		return mapper( obj );
	};

	// Serialize ve.dm.Transaction objects.
	var serializeIntention = function(transaction) {
		var ve = window.ve; // be safe w.r.t load order.
		return deepcopy( transaction.intention, function mapper( value ) {
			if ( value instanceof ve.Range ) {
				return { type: 've.Range', from: value.from, to: value.to };
			}
			if ( value instanceof ve.dm.Annotation ) {
				return {
					type: 've.dm.Annotation',
					// handle any embedded DOM nodes
					element: deepcopy( value.element, mapper )
				};
			}
			if ( value && value.nodeType ) {
				return {
					type: 'DOM Node',
					html: $('<body/>').append( $( value ).clone() ).html()
				};
			}
		});
	};
	// Deserialize ve.dm.Transaction objects.
	var parseIntention = function( obj ) {
		var ve = window.ve; // be safe w.r.t load order.
		assert( !( obj instanceof ve.dm.Transaction ) );
		var intention = deepcopy( obj, function parser( value ) {
			if ( value && typeof value ==='object' ) {
				if ( value.type === 've.Range' ) {
					return new ve.Range( value.from, value.to );
				}
				if ( value.type === 've.dm.Annotation' ) {
					// handle embedded DOM nodes
					var element = deepcopy( value.element, parser );
					return ve.dm.annotationFactory.create( element.type, element );
				}
				if ( value.type === 'DOM Node' ) {
					return $.parseHTML( value.html )[0];
				}
			}
		});
		//return new ve.dm.Transaction.newFromIntention( doc, intention ); //XXX
		return intention;
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
		var history, i, transactions;
		// Roll back model state to 'historyPointer'
		// (after this point, all transactions from historyPointer to the
		// end of the complete history should have hasBeenApplied()==false)
		// xxx this is a bit of a hack; ideally it should be upstreamed

		history = dmSurface.documentModel.getCompleteHistorySince(
			this.historyPointer);
		transactions = [];
		for (i = history.length - 1; i >= 0; i--) {
			if (!history[i].UNDONE) {
				continue; /* skip undone */
			}
			assert(!history[i].UNDONE);
			var r = history[i].reversed();
			r.UNDONE = history[i].UNDONE = true;
			transactions.push( r );
		}
		if (transactions.length > 0) {
			dmSurface.changeInternal(
				transactions, new window.ve.Range( 0, 0 ), true
			);
		}

		// apply the transactions in the queue to the model
		// XXX selection is lost.
		this.getQueue().forEach(function( txproxy ) {
			var tx = txproxy.toTx( dmSurface.documentModel );
			dmSurface.changeInternal(
				[ tx ], new window.ve.Range( 0, 0 ), true
			);
		});

		dmSurface.emit( 'history' ); // voodoo

		// now we're up to date!
		this.historyPointer =
			dmSurface.documentModel.getCompleteHistoryLength();
		this.queue = null;
	};

	// Transaction proxy objects.
	var VETransProxy = function(transaction, intention) {
		assert(transaction === null ? Array.isArray( intention ) : transaction instanceof window.ve.dm.Transaction);
		this.transaction = transaction;
		this.intention = transaction ? transaction.intention : intention;
	};
	VETransProxy.prototype.toTx = function( doc ) {
		return this.transaction ||
			window.ve.dm.Transaction.newFromIntention( doc, this.intention );
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
			h === this.transaction && !h.UNDONE) {
			result.historyPointer = docproxy.historyPointer + 1;
			return result;
		}
		// Otherwise, leave the history pointer alone and add this
		// patch to the queue.
		result.historyPointer = docproxy.historyPointer;
		result.queue = {
			item: this,
			tail: docproxy.queue
		};
		return result;
	};
	VETransProxy.prototype.transpose = function(transproxy) {
		// Implemented in VE core.  Unwrap/wrap here.
		return new VETransProxy(
			this.transaction.transpose(transproxy.transaction));
	};

	// Create a VisualEditor tracker for TogetherJS.
	var VETracker = function(el, sendData) {
		this.element = (el instanceof $) ? el[0] : el; // real DOM element
		this.surface = findVE(el);
		this.documentModel = this.surface.model.documentModel;
		this.sendData = sendData.bind(null);

		// Find the Target corresponding to this instance of VE, so we
		// can snarf out the revision ID.  (Pages loaded at different
		// times might have differing revision IDs!)
		// XXX ONLY ONE TARGET NOW?
		var target = window.ve.init.target;
		/*
		var target = null;
		window.ve.init.mw.targets.forEach(function(t) {
			if (t.surface === this.surface) { target = t; }
		}.bind(this));
		*/
		this.revid = target ? target.revid : undefined;

		// add change listener
		this.surface.model.documentModel.on('transact', this._change, [], this);
	};
	VETracker.prototype.trackerName = "VisualEditor";

	VETracker.prototype.tracked = function(el) {
		return this.element === el;
	};

	VETracker.prototype.getHistory = function() {
		return this.history;
	};

	VETracker.prototype.setHistory = function(history) {
		// XXX ensure that we're using our own subclass of history?
		return (this.history = history);
	};

	VETracker.prototype.getContent = function() {
		var docproxy = new VEDocProxy(this);
		docproxy.historyPointer =
			this.documentModel.getCompleteHistoryLength();
		return docproxy;
	};

	VETracker.prototype.destroy = function(el) {
		// remove change listener
		this.surface.model.documentModel.off('transact', this._change);
	};

	VETracker.prototype._change = function() {
		// suppress change event while we're updating the model
		if (this._inRemoteUpdate) { return; }

		// add transactions since most recent current history point.
		// XXX be careful about undone transactions XXX
		var commitPointer = this.history.current.historyPointer;
		this.documentModel.getCompleteHistorySince(commitPointer).
			forEach(function(transaction) {
				if (transaction.UNDONE) { return; }
				this.sendData({
					tracker: this.trackerName,
					element: this.element,
					value: transaction
				});
			}.bind(this));
	};

	VETracker.prototype.makeDelta = function(history, transaction) {
		return new VETransProxy(transaction);
	};

	VETracker.prototype.serializeDelta = function(delta) {
		return serializeIntention( delta.transaction );
	};

	VETracker.prototype.parseDelta = function(delta) {
		// apply this change to the history.
		return new VETransProxy(null, parseIntention(delta));
	};

	VETracker.prototype.update = function(msg) {
		// XXX maintain selection, someday.
		try {
			this._inRemoteUpdate = true;
			this.history.current.applyToModel();
		} finally {
			this._inRemoteUpdate = false;
		}
	};

	// Sync up a newly-started peer with the existing collaborative state.
	VETracker.prototype.parseInitValue = function( value ) {
		// if revid doesn't match, then we can't synchronize this.
		if (value.revid !== this.revid) { return; }
		// ok, roll back document status then run all the transactions.
		var docproxy = new VEDocProxy(this); // clean slate.
		value.transactions.forEach(function(transaction) {
			transaction = new VETransProxy(null, parseIntention(transaction));
			docproxy = transaction.apply(docproxy);
		});
		return docproxy;
	};

	// Serialize the current state of this visual editor, so
	// that a newly-added peer can be sync'ed up.
	VETracker.prototype.serializeInitValue = function(committed) {
		// Now get the current state of the editor.  We're going to do
		// this by serializing the "complete history" of the document
		// model, up to the latest 'committed' transaction, skipping
		// over undone transactions.  Applying these transactions in
		// order to a pristine document should recreate matching
		// state.
		var commitPointer = committed.historyPointer;
		var transactions = this.documentModel.
			getCompleteHistorySince(0).
			slice(0, commitPointer).
			filter(function(transaction) {
				return !transaction.UNDONE;
			});
		return {
			revid: this.revid,
			transactions: transactions.map(serializeIntention)
		};
	};

	// Find all instances of VE on this page.
	VETracker.scan = function() {
		return instances().map(function(surface, idx) {
			assert(surface.$element.length === 1);
			// add an ID (helps togetherjs find this element)
			surface.$element[0].id = "ve-togetherjs-" + idx;
			// return the element associated with this Surface
			return surface.$element[0];
		});
	};

	// Does the given element correspond to a tracked instance of VE?
	VETracker.tracked = function(el) {
		return instances().some(function(surface) {
			return surface.$element[0] === el;
		});
	};

	// Register this tracker with TogetherJS
	var registerTracker = function() {
		if (!TogetherJS.addTracker) {
			/* jshint devel:true */
			console.warn("Can't register VE tracker, TogetherJS is too old");
			return;
		}
		TogetherJS.addTracker(VETracker, false /* Don't skip setInit */ );
	};
	TogetherJS.on('ready', registerTracker);

	// Hook visual editor, make sure we notice when it's created/destroyed

	// According to Trevor, we should really "just make an
	// ve.InstanceList class, which has add and remove methods and
	// emits add and remove events. Then replace ve.instances and
	// ve.init.target with instances of ve.InstanceList, and make all
	// callers use add/remove instead of push/splice. Then just
	// connect to ve.instances or ve.init.targets and listen for
	// add/remove events. That's the way I recommend doing it."
	// ... but this works fine for now (although it's mediawiki-specific)

	mw.hook( 've.activationComplete' ).add( TogetherJS.reinitialize.bind(TogetherJS) );
	mw.hook( 've.deactivationComplete' ).add( TogetherJS.reinitialize.bind(TogetherJS) );

	// bit of a hack -- defer togetherjs startup until after ve if we're
	// on a ve editing page.  XXX is this a race?
	var uri = new mw.Uri();
	if ( uri.query.veaction === 'edit' ) {
		mw.hook( 've.activationComplete' ).add( function() {
			mw.hook( 'togetherjs.autostart' ).fire();
		});
	} else {
		$( function() { mw.hook( 'togetherjs.autostart' ).fire(); } );
	}

}( mediaWiki, jQuery, TogetherJS ) );
