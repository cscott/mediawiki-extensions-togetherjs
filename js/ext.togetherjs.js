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

( function ( mw, $, TogetherJS ) {
	"use strict";

	// add option to start togetherjs in a action tab
	var pTabsId = $( '#p-views' ).length ? 'p-views' : 'p-cactions';
	mw.util.addPortletLink( pTabsId, '#', mw.msg( 'togetherjs-tab' ),
	                       'ca-tjs-start', mw.msg( 'togetherjs-start' ) );
	$( '#ca-tjs-start' ).click( TogetherJS );

	// add togetherjs to edit source toolbar
	if ( mw.toolbar ) {
		mw.toolbar.addButton({
			imageId: 'togetherjs-button',
			imageFile: TogetherJSConfig.baseUrl +
				'/togetherjs/images/notification-togetherjs-logo.png',
			speedTip: mw.msg( 'togetherjs-start' )
		});
		$( '#togetherjs-button' ).click( function( event ) {
			/* jshint newcap: false */
			TogetherJS(); // toggle togetherjs
			return false;
		} );
	}

}( mediaWiki, jQuery, TogetherJS ) );
