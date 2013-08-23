<?php
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
 *
 * @file
 * @ingroup extensions
 * @author Mark Holmquist <mtraceur@member.fsf.org>
 * @author C. Scott Ananian <cscott@cscott.net)
 * @copyright Copyright © 2013, Mark Holmquist and C. Scott Ananian
 */

$moduleInfo = array(
	'localBasePath' => __DIR__,
	'remoteExtPath' => 'TowTruck',
);

$wgExtensionMessagesFiles['TowTruck'] = __DIR__ . '/TowTruck.i18n.php';

$wgResourceModules['towtruck'] = array_merge( array(
	'scripts' => array(
		'js/towtruck.js',
	),
), $moduleInfo );

$wgResourceModules['ext.towTruck'] = array_merge( array(
	'scripts' => array(
		'js/ext.towTruck.js',
		'js/ext.towTruck.ve.js',
	),

	'dependencies' => array(
		'towtruck',
	),
	'messages' => array(
		'towtruck-name',
		'towtruck-start',
		'towtruck-tab',
	),
), $moduleInfo );

$wgAutoloadClasses['TowTruckHooks'] = __DIR__ . '/TowTruckHooks.php';
$wgHooks['BeforePageDisplay'][] = 'TowTruckHooks::getModules';

$wgExtensionCredits['other'][] = array(
	'path' => __FILE__,
	'name' => 'TowTruck',
	'descriptionmsg' => 'towtruck-desc',
	'version' => '0.1',
	'author' => array(
		'MarkTraceur (Mark Holmquist)',
		'cscott (C. Scott Ananian)',
	),
	'url' => 'https://mediawiki.org/wiki/Extension:TowTruck',
);
