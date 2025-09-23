'use strict';

var _activeHeadersByTabID = {};

/*
 * Handle headers as they come in
 */
chrome.webRequest.onHeadersReceived.addListener(
	function(info) {
        if (parseInt(info.tabId, 10) > 0) {
            _activeHeadersByTabID[info.tabId] = info;
        }

        // Check if this looks like a text file that should be displayed
        var url = info.url;
        var isTextFile = /\.(txt|log|toml|ini|yaml|yml|json|xml|html|css|js|md|py|go|rs|java|c|cpp|h|sh)(\?.*)?$/i.test(url);

        if (isTextFile && info.responseHeaders) {
            var modified = false;
            var newHeaders = [];

            for (var i = 0; i < info.responseHeaders.length; i++) {
                var header = info.responseHeaders[i];

                // Remove Content-Disposition attachment header
                if (header.name.toLowerCase() === 'content-disposition' &&
                    header.value.toLowerCase().includes('attachment')) {
                    modified = true;
                    continue; // Skip this header
                }

                // Change content-type to text/plain for better display
                if (header.name.toLowerCase() === 'content-type' &&
                    !header.value.toLowerCase().startsWith('text/')) {
                    header.value = 'text/plain; charset=utf-8';
                    modified = true;
                }

                newHeaders.push(header);
            }

            if (modified) {
                return { responseHeaders: newHeaders };
            }
        }
    },
    {
        urls: ['http://*/*', 'https://*/*', 'file://*'],
        types: ['main_frame']
    },
    ['responseHeaders', 'blocking']
);

/*
 * Message listener
 */
chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
    var response = {};
    if (request.msg === 'startListening' && typeof sender.tab !== 'undefined' && parseInt(sender.tab.id, 10) > 0) {
        // Grab the headers and toss them back to content.js
		chrome.tabs.sendRequest(sender.tab.id, {
			msg: 'headersReceived',
			headers: _activeHeadersByTabID[sender.tab.id]
		});
    } else if (request.msg === 'getSettings' ) {
        response = getOrCreateSettings();
    } else if (request.msg === 'setNextRatingPromptDate') {
        setNextRatingPromptDate(request.days);
    }
    
    sendResponse(response);
});

/**
 * When a tab closes, get rid of its headers from the active collection
 */
chrome.tabs.onRemoved.addListener(function(tabId) {
    delete _activeHeadersByTabID[tabId];
});