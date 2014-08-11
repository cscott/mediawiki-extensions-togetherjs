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
 * @author C. Scott Ananian <cscott@cscott.net)
 * @copyright Copyright © 2013, Mark Holmquist and C. Scott Ananian
 */

$moduleInfo = array(
	'localBasePath' => __DIR__,
	'remoteExtPath' => 'TogetherJS',
);

$wgExtensionMessagesFiles['TogetherJS'] = __DIR__ . '/TogetherJS.i18n.php';

$wgResourceModules['togetherjs'] = array_merge( array(
	'scripts' => array(
		'js/ext.togetherjs.config.js',
		'js/togetherjs.js',
	),
	'dependencies' => array(
		'mediawiki.user',
	),
	'messages' => array(
		'togetherjs-name',
	),
), $moduleInfo );

$wgResourceModules['ext.togetherjs'] = array_merge( array(
	'scripts' => array(
		'js/ext.togetherjs.js',
		'js/ext.togetherjs.ve.js',
	),

	'dependencies' => array(
		'togetherjs',
	),
	'messages' => array(
		'togetherjs-name',
		'togetherjs-start',
		'togetherjs-tab',
	),
), $moduleInfo );

$wgAutoloadClasses['TogetherJSHooks'] = __DIR__ . '/TogetherJS.hooks.php';
$wgHooks['BeforePageDisplay'][] = 'TogetherJSHooks::getModules';

$wgExtensionCredits['other'][] = array(
	'path' => __FILE__,
	'name' => 'TogetherJS',
	'descriptionmsg' => 'togetherjs-desc',
	'version' => '0.1',
	'author' => array(
		'C. Scott Ananian'
	),
	'url' => 'https://mediawiki.org/wiki/Extension:TogetherJS',
);
