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

( function ( mw, $, tt ) {

	TowTruckConfig_toolName = mw.msg( 'towtruck-name' );
	// add option to start tooltruck in a action tab
	var pTabsId = $( '#p-views' ).length ? 'p-views' : 'p-cactions';
	mw.util.addPortletLink( pTabsId, '#', mw.msg( 'towtruck-tab' ),
	                       'ca-tt-start', mw.msg( 'towtruck-start' ) );
	$( '#ca-tt-start' ).click( tt );

	// add towtruck to edit source toolbar
	if (mw.toolbar) {
		mw.toolbar.addButton({
			imageId: 'towtruck-button',
			imageFile: 'http://towtruck.github.cscott.net/images/icn-logo-blk.png',
			speedTip: mw.msg( 'towtruck-start' )
		});
		$( '#towtruck-button' ).click( function(event) {
			tt(); // toggle towtruck
			return false;
		} );
	}

	// Hook visual editor, make sure we notice when it's created/destroyed

	// According to Trevor, we should really "just make an
	// ve.InstanceList class, which has add and remove methods and
	// emits add and remove events. Then replace ve.instances and
	// ve.init.target with instances of ve.InstanceList, and make all
	// callers use add/remove instead of push/splice. Then just
	// connect to ve.instances or ve.init.targets and listen for
	// add/remove events. That's the way I recommend doing it."
	// ... but this works fine for now (although it's mediawiki-specific)

	mw.hook( 've.activationComplete' ).add( tt.reinitialize.bind(tt) );
	mw.hook( 've.deactivationComplete' ).add( tt.reinitialize.bind(tt) );

}( mediaWiki, jQuery, TowTruck ) );
