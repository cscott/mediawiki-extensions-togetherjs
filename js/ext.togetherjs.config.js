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

/* TogetherJS configuration; loaded *before* TogetherJS loads. */
TogetherJSConfig = {
	toolName: mw.msg( 'togetherjs-name' ),
	baseUrl: mw.config.get( 'wgServer' ) +
		mw.config.get( 'wgExtensionAssetsPath' ) +
		'/TogetherJS',
	hubBase: 'https://togetherjs-hub.wmflabs.org',
	lang: (function(lang) {
		// re-map language codes to those supported by togetherJS
		if (/^ru/.test(lang)) return "ru";
		return "en-US";
	})(mw.config.get( 'wgUserLanguage' )),
	callToStart: function(callback) {
		// defer loading of TogetherJS until after mw loads.
		var hook = mw.hook( 'togetherjs.autostart' );
		var once = function() {
			hook.remove(once);
			callback();
		};
		hook.add( once );
	},
	getUserName: function() {
		if (mw.user.isAnon()) { return null; }
		return mw.user.getName();
	}
};
