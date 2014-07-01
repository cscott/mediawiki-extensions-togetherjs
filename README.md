# Mediawiki TogetherJS extension

This is a [MediaWiki][] extension which adds real-time collaborative
editing using Mozilla's [TogetherJS][] project.  It enables real-time
collaboration on both the wikitext source for an article, as well as
when editing using the [VisualEditor][].

## Developing and installing

For information on installing this extension on a local wiki, please
see https://www.mediawiki.org/wiki/Extension:TogetherJS.  You might
also like to install VisualEditor; for that, see
https://www.mediawiki.org/wiki/Extension:VisualEditor .

## Rebuilding TogetherJS

The sources in `js/togetherjs.js` are built from the TogetherJS
sources on github.  The [history of that file][] should state how
the file was last build, and from what upstream commit.  To rebuild,
check out TogetherJS from github, switch to the appropriate upstream
branch (development happens on the `develop` branch, and gets merged
to `master` on release), and build as follows:
```sh
$ git clone https://github.com/mozilla/togetherjs.git
$ cd togetherjs
$ git checkout develop # or other appropriate branch
$ npm install
$ npm install grunt-cli
$ node_modules/.bin/grunt build --base-url //togetherjs.wmflabs.org/extensions/TogetherJS/togetherjs --hub-url https://togetherjs-hub.wmflabs.org --no-hardlink --dest mw-ext
```
Then copy the files from `mw-ext`.  Assuming your newly-built copy of
togetherjs is in `$TJS/mw-ext`, change back to this repository and:
```sh
$ git rm -rf togetherjs
$ cp $TJS/mw-ext/togetherjs.js js/
$ cp -r $TJS/mw-ext/togetherjs ./
$ git add js/togetherjs.js togetherjs
```
Note that we don't bother to copy the minified version of TogetherJS,
since the Mediawiki resource loader will take care of minifying all
of our sources when appropriate.

[MediaWiki]:            https://www.mediawiki.org/wiki/MediaWiki
[TogetherJS]:           https://togetherjs.mozillalabs.com/
[VisualEditor]:         https://www.mediawiki.org/wiki/VisualEditor
[history of that file]: https://github.com/cscott/mediawiki-extensions-togetherjs/commits/master/js/togetherjs.js
