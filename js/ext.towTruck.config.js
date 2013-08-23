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

/* TowTruck configuration; loaded *before* TowTruck loads. */
TowTruckConfig_toolName = mw.msg( 'towtruck-name' );
TowTruckConfig_callToStart = function(callback) {
	// defer loading of TowTruck until after mw loads.
	var hook = mw.hook( 'towtruck.autostart' );
	var once = function() {
		hook.remove(once);
		callback();
	};
	hook.add( once );
};
