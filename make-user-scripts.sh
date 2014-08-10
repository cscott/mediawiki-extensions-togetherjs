#!/bin/bash

USER=cscott
JS=$(dirname $0)/js
OUT=$(dirname $0)/userscripts

# Convert the sources here to something appropriate for userscripts.
mkdir -p $OUT

# TogetherJS.js
cat > $OUT/TogetherJS.js <<EOF
// Note that \`importScript\` doesn't support dependencies between scripts.
// We work around this by dividing our code into modules, but chaining
// forward to all dependent modules.  This code will complete before the
// code imported here is executed.
importScript( 'User:$USER/TogetherJS-loader.js' );

// HACK MESSAGES INTO mw.messages
(function(o) {
	Object.keys(o).forEach(function(k) {
		mw.messages.set(k, o[k]);
	});
})({
	'togetherjs-name': 'TogetherJS',
	'togetherjs-start': 'Start working together',
	'togetherjs-tab': 'Together',
	'togetherjs-desc': 'Add realtime collaboration to wiki editing.'
});
EOF
tail -n +18 $JS/ext.togetherjs.config.js >> $OUT/TogetherJS.js
cat >> $OUT/TogetherJS.js <<EOF
TogetherJSConfig.baseUrl = "//togetherjs.wmflabs.org/extensions/TogetherJS";
if (window.TOGETHERJS_BETA) {
	// crazy experimental stuff
	TogetherJSConfig.baseUrl += '-Beta';
	TogetherJSConfig.useMinimizedCode = false;
} else {
	// actually, always use the new togetherjs (for now)
	TogetherJSConfig.baseUrl += '-Beta';
}
EOF

# TogetherJS-loader.js
cat > $OUT/TogetherJS-loader.js <<EOF
// ensure these dependencies are loaded *after* this file defines TogetherJS.
importScript( 'User:$USER/TogetherJS-ext.js');
if (window.TOGETHERJS_BETA) {
	importScript( 'User:$USER/TogetherJS-ext-ve.js');
}
// THIS IS BUILT FROM THE UPSTREAM TogetherJS source.
EOF
cat $JS/togetherjs.js >> $OUT/TogetherJS-loader.js

# TogetherJS-ext.js
cat $JS/ext.togetherjs.js > $OUT/TogetherJS-ext.js
cat >> $OUT/TogetherJS-ext.js <<EOF
if (!window.TOGETHERJS_BETA) {
	\$( function() { mw.hook( 'togetherjs.autostart' ).fire(); } );
}
EOF

# TogetherJS-ext-ve.js
cat $JS/ext.togetherjs.ve.js > $OUT/TogetherJS-ext-ve.js
