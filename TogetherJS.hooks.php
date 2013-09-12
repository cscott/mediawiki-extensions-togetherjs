<?php
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
 *
 * @file
 * @ingroup extensions
 * @author Mark Holmquist <mtraceur@member.fsf.org>
 * @author C. Scott Ananian <cscott@cscott.net>
 * @copyright Copyright © 2013, Mark Holmquist and C. Scott Ananian
 */

class TogetherJSHooks {

	// Add the togetherjs scripts to the page so we can do cool things
	static function getModules( $out, $skin ) {
		$out->addModules( array( 'ext.togetherjs' ) );

		return true;
	}
}
