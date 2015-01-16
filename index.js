var checkDefaultBrowser = require('x-default-browser');

/**
 * @param Array<String> preferredBrowsers
 * @return Function
 */
function getBrowserFilter (preferredBrowsers) {
    /**
     * @param Object{name, version, type, command} item
     * @return true for browsers present in preferredBrowsers
     */
    return function (item) {
        return (preferredBrowsers.indexOf(item.name) > -1);
    };
}

/**
 * @param Array<String> preferredBrowsers
 * @param Array<Object{name, version, type, command}> availableBrowsers
 * @return String: "chrome", "opera" or "chromium" or null
 */
function getBrowserCommand (preferredBrowsers, availableBrowsers) {
    var filterFunc = function(browserName) {
        return function(item) {
            return item.name == browserName;
        };
    };

    for (var i = 0; i < preferredBrowsers.length; i++) {
        var browserName = preferredBrowsers[i];
        var gotThatBrowser = availableBrowsers.some(filterFunc(browserName));

        if (gotThatBrowser) {
            return browserName;
        }
    }

    return null;
}

function useOpener (url, cb) {
    var opener = require('opener');
    opener(url, cb);
}

function isArray (value) {
    return Object.prototype.toString.apply(value) === "[object Array]";
}

function isDefaultBrowserGoodEnough (commonName, preferredBrowsers) {
    return preferredBrowsers.indexOf(commonName) > -1;
}

/**
 * Opens a URL in some preferred browser if available, and calls the callback.
 * The priority is given to the user's default browser (if it's on the preferred
 * browsers list), then to the first found browser from the list.
 * If none of the preferred browsers is available, it calls the error callback.
 *
 * `cfg` defaults to {verbose:false, preferredBrowsers: ["chrome"]}
 * `cb` defaults (roughly) to console.error
 * @param {String} url
 * @param optional {Object} cfg {verbose: Boolean, preferredBrowsers: Array<String>}
 * @param optional {Function} cb function(error, stdout|okMessage, stderr)
 */
module.exports = function (url, cfg, cb) {
    cfg = cfg || {
        verbose: false,
        preferredBrowsers: ["chrome"]
    };
    cb = cb || (function (err) {
        if (err) console.error(err);
    });
    var preferredBrowsers = cfg.preferredBrowsers;
    if (!isArray(preferredBrowsers)) {
        return cb(new Error("preferredBrowsers has to be an array"));
    }

    checkDefaultBrowser(function(err, browserInfo) {
        var goodEnough = isDefaultBrowserGoodEnough(browserInfo.commonName, preferredBrowsers);
        if (!err && goodEnough) {
            // great, default browser is good, let's use opener to open the URL with that browser
            if (cfg.verbose) {
                console.log('Using default browser via opener; it should open ' + browserInfo.commonName);
            }
            return useOpener(url, cb);
        }
        if (cfg.verbose && !goodEnough) {
            console.log('Default browser is ' + browserInfo.commonName + '; looking further for browsers matching [' + preferredBrowsers.toString() + ']...');
        }

        // either we failed checking for default browser, or default browser is not matching the spec
        // let's check if we have some spec-conforming browser in the system
        var launcher = require('browser-launcher2');
        launcher.detect(function(availableBrowsers) {
            availableBrowsers = availableBrowsers.filter(getBrowserFilter(preferredBrowsers));
            // console.dir(availableBrowsers);
            // console.dir(preferredBrowsers);

            if (availableBrowsers.length === 0) {
                var msg = 'No browser matching [' + preferredBrowsers.toString() + ']  found in the system! If this is not true, submit a bug report on https://github.com/benderjs/browser-launcher2';
                if (cfg.verbose){
                    console.log(msg);
                }
                return cb(new Error(msg));
            }

            // choose from available browsers in order of preference
            var command = getBrowserCommand(preferredBrowsers, availableBrowsers);
            launcher(function(err, launch) {
                // checking err makes sense only when passing config, no need to do it here
                launch(url, command, function(err, instance) {
                    if (err) {
                        var msg = 'Unable to start the executable of ' + command;
                        if (cfg.verbose){
                            console.log(msg);
                        }
                        cb(new Error(msg));
                    }
                    if (cfg.verbose) {
                        console.log('Browser ' + command + ' started with PID:', instance.pid);
                        instance.on('stop', function(code) {
                            console.log('Instance stopped with exit code:', code);
                        });
                    }
                    cb(null, 'Started ' + command + ' successfully');
                });
            });

        });
    });
};
