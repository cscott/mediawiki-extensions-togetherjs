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

	// Create a VisualEditor tracker for TowTruck.
	var VETracker = function(el) {
		this.element = $(el);
		this.surface = findVE(el);
		console.assert(this.surface);
		// add change listener
		this.surface.model.on('change', this._change, [], this);
	};
	VETracker.prototype.trackerName = "VisualEditor";
	VETracker.prototype.tracked = function(el) {
		return this.element[0] === el;
	};
	VETracker.prototype.destroy = function(el) {
		// remove change listener
		this.surface.model.off('change', this._change);
	};
	VETracker.prototype._change = function() {
		console.log("VE _change");
	};
	VETracker.prototype.update = function(msg) {
		console.log("VE update");
		// XXX apply deltas
	};
	VETracker.prototype.init = function(update, msg) {
		console.log("VE init");
		// XXX initialize
	};
	VETracker.prototype.makeInit = function() {
		console.log("VE makeInit");
		var elementFinder = TowTruck.require("elementFinder");
		var value = 'XXX';
		return {
			element: elementFinder.elementLocation(this.element),
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
