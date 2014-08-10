// Note that `importScript` doesn't support dependencies between scripts.
// We work around this by dividing our code into modules, but chaining
// forward to all dependent modules.  This code will complete before the
// code imported here is executed.
importScript( 'User:cscott/TogetherJS-loader.js' );

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
/* TogetherJS configuration; loaded *before* TogetherJS loads. */
TogetherJSConfig = {
	toolName: mw.msg( 'togetherjs-name' ),
	baseUrl: mw.config.get( 'wgServer' ) +
		mw.config.get( 'wgExtensionAssetsPath' ) +
		'/TogetherJS',
	hubBase: 'https://togetherjs-hub.wmflabs.org',
	// For ACE compatibility, use minimized code.  Otherwise TogetherJS
	// wants to define `window.require`, which apparently ACE also uses.
	useMinimizedCode: true,
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
TogetherJSConfig.baseUrl = "//togetherjs.wmflabs.org/extensions/TogetherJS";
if (window.TOGETHERJS_BETA) {
	// crazy experimental stuff
	TogetherJSConfig.baseUrl += '-Beta';
	TogetherJSConfig.useMinimizedCode = false;
}
