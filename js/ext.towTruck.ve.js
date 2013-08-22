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
		// XXX add change listener
	};
	VETracker.trackerName = "VisualEditor";
	VETracker.prototype.destroy = function(el) {
		// XXX remove change listeners
	};

	// Find all instances of VE on this page.
	VETracker.scan = function() {
		return instances().map(function(surface) {
			console.assert(surface.$.length === 1);
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
		if (!TowTruck.trackers) {
			console.warn("Can't register VE tracker, TowTruck is too old");
			return;
		}
		TowTruck.trackers[VETracker.trackerName] = VETracker;
	};

	// Defer registration if TowTruck is not loaded yet.
	if (TowTruck.require) {
		registerTracker();
	} else {
		TowTruck.once('ready', registerTracker);
	}

}( mediaWiki, jQuery, TowTruck ) );
