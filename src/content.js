'use strict';

/*
 * Tell background.js to start listening for headers
 */
chrome.extension.sendRequest({
    msg: 'startListening'
});

/*
 * Message listener
 */
chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
    var contentType = null;
	if (request.msg === 'headersReceived' && request.headers != null && request.headers.responseHeaders.length > 0) {
        for (var i = 0; i < request.headers.responseHeaders.length; i++) {
			var header = request.headers.responseHeaders[i];
			if (header.name == 'Content-Type') {
				contentType = header.value.substring(0, header.value.indexOf(';'));
			}
		}
    }
    sendResponse({});
    
    var bodyElement = $('body');
    var prettyPrintableElement = getPrettyPrintableElement(bodyElement);
    
    if (prettyPrintableElement != null) {
        var extension = getExtensionFromUrl(document.location.href);
        if (extension != null) {
            if (/.+\/json/i.test(contentType)) {
        		 // Override to JSON
        		 extension = 'json';
        	 } else if (/.+\/xml/i.test(contentType)) {
        		 // Override to XML
        		 extension = 'xml';
        	 }
        }
        var editorMode =  getModeForExtension(extension);
        // console.log('Pretty printing the ' + prettyPrintableElement.nodeName + ' element with extension ' + extension + ' (mode ' + editorMode + ')');
        applyEditor(bodyElement == null ? document : bodyElement, editorMode, prettyPrintableElement.innerText);
    }
});

/*
 * Finds the element to pretty print (if any)
 */
function getPrettyPrintableElement(bodyElement) {
	if (bodyElement == null) {
        return document;
	} else {
        var children = bodyElement.children();
        if (children.length == 0) {
            return bodyElement;
        } else if (children[0].nodeName == 'PRE') {
            return children[0];
        }
        
        return null;
    }
}

/*
 * Extracts the file extension from the URL
 */ 
function getExtensionFromUrl(url) {
    var ext = null;
    if (url != null && url.length > 0) {
        var urlParts = url.split('?')[0].split('/');
        if (urlParts.length > 0) {
            var lastUrlPiece = urlParts[urlParts.length - 1].split('#')[0];
            if (lastUrlPiece.indexOf('.') >= 0) {
                var dotPieces = lastUrlPiece.split('.');
                ext = dotPieces[dotPieces.length - 1];
            }
        }
    }
    return ext;
}

/*
 * Converts the extension to the proper editor language mode
 */ 
function getModeForExtension(ext) {
    var mode = 'plain-text';
    if (ext != null) {
        ext = ext.trim().toLowerCase();
        switch (ext) {
        case 'xml':
        case 'csproj':
            mode = 'xml';
            break;
        case 'html':
            mode = 'html';
            break;
        case 'cshtml':
        case 'aspx':
            mode = 'htmlmixed';
            break;
        case 'cs':
        case 'java':
        case 'c':
            mode = 'clike';
            break;
        case 'sql':
            mode = 'sql';
            break;
        case 'js':
        case 'txt':
        case 'log':
        case 'toml':
        case 'ini':
        case 'yaml':
        case 'yml':
            mode = 'javascript';
            break;
        case 'css':
            mode = 'css';
            break;
        default:
            break;
        }
    }

    return mode;
}

/*
 * Applies the editor to the specified element
 */ 
function applyEditor(containerElement, codeMode, content) {
    chrome.extension.sendRequest({
        msg : "getSettings"
    }, function (settings) {
        var url = document.location.href;
        var state = getFileState(url);

        var editor = CodeMirror(function (codeEditorElement) {
            containerElement.html(codeEditorElement)
        }, {
            value : content,
            readOnly: true,
            lineNumbers : true,
            fullScreen : true,
            lineWrapping : state.lineWrapping !== undefined ? state.lineWrapping : settings.doLineWrap,
            mode : codeMode,
            useCPP : (codeMode == "clike"),
            keyMap: "default",
            extraKeys: {}
        });

        editor.on('keydown', function(cm, event) {
            if (!event.ctrlKey && !event.metaKey && !event.altKey) {
                event.codemirrorIgnore = true;
            }
        });
        applyStyleFromSettings(settings);
        editor.execCommand("goDocEnd");
        addWrapToggleButton(editor, url);
        addCenterToggleButton(url);
        addHideCharsButton(editor, url, state);
        addHideColumnsButton(editor, url, state);
    });
}

function getFileState(url) {
    var key = 'btv_state_' + url;
    var state = localStorage[key];
    return state ? JSON.parse(state) : {};
}

function saveFileState(url, state) {
    var key = 'btv_state_' + url;
    localStorage[key] = JSON.stringify(state);
}

function addWrapToggleButton(editor, url) {
    var button = $('<button id="wrapToggle">Toggle Wrap</button>');
    button.css({
        'position': 'fixed',
        'top': '10px',
        'right': '10px',
        'z-index': 9999,
        'padding': '8px 12px',
        'background-color': '#3e3e42',
        'color': '#d4d4d4',
        'border': '1px solid #858585',
        'border-radius': '4px',
        'cursor': 'pointer',
        'font-family': 'monospace'
    });
    button.click(function() {
        var wrap = editor.getOption('lineWrapping');
        editor.setOption('lineWrapping', !wrap);
        editor.execCommand('goDocEnd');
        var state = getFileState(url);
        state.lineWrapping = !wrap;
        saveFileState(url, state);
    });
    $('body').append(button);
}

function addCenterToggleButton(url) {
    var state = getFileState(url);
    var centered = state.centerView !== undefined ? state.centerView : true;

    var button = $('<button id="centerToggle">Toggle Center</button>');
    button.css({
        'position': 'fixed',
        'top': '10px',
        'right': '140px',
        'z-index': 9999,
        'padding': '8px 12px',
        'background-color': '#3e3e42',
        'color': '#d4d4d4',
        'border': '1px solid #858585',
        'border-radius': '4px',
        'cursor': 'pointer',
        'font-family': 'monospace'
    });

    function applyCenterView(centered) {
        var cm = $('.CodeMirror');
        if (centered) {
            cm.css({
                'width': '50%',
                'margin': '0 auto'
            });
        } else {
            cm.css({
                'width': '100%',
                'margin': '0'
            });
        }
    }

    applyCenterView(centered);

    button.click(function() {
        centered = !centered;
        applyCenterView(centered);
        var state = getFileState(url);
        state.centerView = centered;
        saveFileState(url, state);
    });

    $('body').append(button);
}

function addHideCharsButton(editor, url, state) {
    var container = $('<div id="hideCharsControls"></div>');
    container.css({
        'position': 'fixed',
        'top': '50px',
        'right': '10px',
        'z-index': 9999,
        'background-color': '#3e3e42',
        'color': '#d4d4d4',
        'border': '1px solid #858585',
        'border-radius': '4px',
        'padding': '8px',
        'font-family': 'monospace'
    });

    var hideChars = state.hideChars || 50;
    var input = $('<input type="number" id="hideCharsInput" placeholder="50" value="' + hideChars + '" />');
    input.css({
        'width': '60px',
        'padding': '4px',
        'margin-right': '5px',
        'background-color': '#252526',
        'color': '#d4d4d4',
        'border': '1px solid #858585',
        'font-family': 'monospace'
    });

    var button = $('<button id="hideCharsToggle">Hide Chars</button>');
    button.css({
        'padding': '4px 8px',
        'background-color': '#252526',
        'color': '#d4d4d4',
        'border': '1px solid #858585',
        'cursor': 'pointer',
        'font-family': 'monospace'
    });

    container.append(input);
    container.append(button);

    var hidden = state.charsHidden || false;
    var original = editor.getValue();

    if (hidden) {
        var n = hideChars;
        var lines = original.split('\n');
        var processed = lines.map(function(line) {
            return line.substring(n);
        });
        editor.setValue(processed.join('\n'));
        button.text('Show All');
        setTimeout(function() {
            editor.execCommand('goDocEnd');
        }, 100);
    }

    button.click(function() {
        if (!hidden) {
            var n = parseInt(input.val()) || 0;
            var lines = original.split('\n');
            var processed = lines.map(function(line) {
                return line.substring(n);
            });
            editor.setValue(processed.join('\n'));
            button.text('Show All');
            hidden = true;
            var fileState = getFileState(url);
            fileState.charsHidden = true;
            fileState.hideChars = n;
            saveFileState(url, fileState);
        } else {
            editor.setValue(original);
            button.text('Hide Chars');
            hidden = false;
            var fileState = getFileState(url);
            fileState.charsHidden = false;
            saveFileState(url, fileState);
        }
        editor.execCommand('goDocEnd');
    });

    input.on('change', function() {
        var fileState = getFileState(url);
        fileState.hideChars = parseInt(input.val()) || 50;
        saveFileState(url, fileState);
    });

    input.on('keypress', function(e) {
        if (e.which === 13) {
            button.click();
        }
    });

    $('body').append(container);
}

function addHideColumnsButton(editor, url, state) {
    var container = $('<div id="hideColumnsControls"></div>');
    container.css({
        'position': 'fixed',
        'top': '100px',
        'right': '10px',
        'z-index': 9999,
        'background-color': '#3e3e42',
        'color': '#d4d4d4',
        'border': '1px solid #858585',
        'border-radius': '4px',
        'padding': '8px',
        'font-family': 'monospace'
    });

    var hideColumns = state.hideColumns || 3;
    var delimiter = state.delimiter || '\t';

    var inputCols = $('<input type="number" id="hideColumnsInput" placeholder="3" value="' + hideColumns + '" />');
    inputCols.css({
        'width': '40px',
        'padding': '4px',
        'margin-right': '5px',
        'background-color': '#252526',
        'color': '#d4d4d4',
        'border': '1px solid #858585',
        'font-family': 'monospace'
    });

    var inputDelim = $('<input type="text" id="delimiterInput" placeholder="\\t" value="' + (delimiter === '\t' ? '\\t' : delimiter) + '" />');
    inputDelim.css({
        'width': '40px',
        'padding': '4px',
        'margin-right': '5px',
        'background-color': '#252526',
        'color': '#d4d4d4',
        'border': '1px solid #858585',
        'font-family': 'monospace'
    });

    var button = $('<button id="hideColumnsToggle">Hide Cols</button>');
    button.css({
        'padding': '4px 8px',
        'background-color': '#252526',
        'color': '#d4d4d4',
        'border': '1px solid #858585',
        'cursor': 'pointer',
        'font-family': 'monospace'
    });

    container.append(inputCols);
    container.append(inputDelim);
    container.append(button);

    var hidden = state.columnsHidden || false;
    var original = editor.getValue();

    if (hidden) {
        var n = hideColumns;
        var delim = delimiter;
        var lines = original.split('\n');
        var processed = lines.map(function(line) {
            var parts = line.split(delim);
            return parts.slice(n).join(delim);
        });
        editor.setValue(processed.join('\n'));
        button.text('Show All');
        setTimeout(function() {
            editor.execCommand('goDocEnd');
        }, 100);
    }

    button.click(function() {
        if (!hidden) {
            var n = parseInt(inputCols.val()) || 0;
            var delimValue = inputDelim.val();
            var delim = delimValue === '\\t' ? '\t' : delimValue;
            var lines = original.split('\n');
            var processed = lines.map(function(line) {
                var parts = line.split(delim);
                return parts.slice(n).join(delim);
            });
            editor.setValue(processed.join('\n'));
            button.text('Show All');
            hidden = true;
            var fileState = getFileState(url);
            fileState.columnsHidden = true;
            fileState.hideColumns = n;
            fileState.delimiter = delim;
            saveFileState(url, fileState);
        } else {
            editor.setValue(original);
            button.text('Hide Cols');
            hidden = false;
            var fileState = getFileState(url);
            fileState.columnsHidden = false;
            saveFileState(url, fileState);
        }
        editor.execCommand('goDocEnd');
    });

    inputCols.on('change', function() {
        var fileState = getFileState(url);
        fileState.hideColumns = parseInt(inputCols.val()) || 3;
        saveFileState(url, fileState);
    });

    inputDelim.on('change', function() {
        var delimValue = inputDelim.val();
        var delim = delimValue === '\\t' ? '\t' : delimValue;
        var fileState = getFileState(url);
        fileState.delimiter = delim;
        saveFileState(url, fileState);
    });

    inputCols.on('keypress', function(e) {
        if (e.which === 13) {
            button.click();
        }
    });

    inputDelim.on('keypress', function(e) {
        if (e.which === 13) {
            button.click();
        }
    });

    $('body').append(container);
}

/*
 * Styles the editor according to the user settings
 */ 
function applyStyleFromSettings(settings) {
    if (settings.fontFamily != 'monospace' || settings.fontSize > 0) {
        if (settings.fontFamily != 'monospace' && settings.fontSize > 0) {
            // override both properties
            $('.CodeMirror').css('font-family', settings.fontFamily).css('font-size', settings.fontFamily);
        } else {
            if (settings.fontFamily != 'monospace') {
                $('.CodeMirror').css('font-family', settings.fontFamily);
            } else {
                $('.CodeMirror').css('font-size', settings.fontSize + 'px');
            }
        }
    }
    
    // Add a rating div to the top-right corner
    addRatingFloater(settings);
}

function addRatingFloater(settings) {
    if (new Date() > settings.nextRatingPromptDate) {
        // Build the ratings box
        $('<div id="ratingsBox">'
            + '<h4 id="ratingsBoxHeader">Do you l<span id="heart">♥</span>ve Better Text Viewer?</h4>'
            + '<hr id="ratingsBoxHr"/>'
            + '<p id="ratingsBoxMessage">If you think this extension is awesome, show your love by heading over to the Chrome webstore and rating it!</p>'
            + '<table id="ratingsBoxButtonTable">'
                + '<tr>'
                    + '<td id="ratingsBoxButtonLeftCell">'
                        + '<input id="btnRateNever" type="button" value="Never"></input>'
                    + '</td>'
                    + '<td id="ratingsBoxButtonRightCell">'
                        + '<input id="btnRateLater" type="button" value="Maybe Later"></input> '
                        + '<input id="btnRateNow" type="button" value="Sure!"></input>'
                    + '</td>'
                + '</tr>'
            + '</table>'
        + '</div>').appendTo($('body') || $(document));
        
        // Style the rest of the elements
        $('#ratingsBoxHeader').css({
            'font-family': 'Arial',
            'margin': '.5em 0 1em 0'
        });
        $('#heart').css({
            'color': 'red',
            'font-weight': 'bold'
        });
        $('#ratingsBoxMessage').css({
            'font-family': 'Arial'
        });
        $('#ratingsBoxButtonTable').css({
            'width': '100%',
            'border': 'none'
        });
        $('#ratingsBoxButtonRightCell').css({
            'text-align': 'right' 
        });
        
        // Attach events to the buttons
        $('#btnRateNever').click(function() {
            chrome.extension.sendRequest({
                msg : "setNextRatingPromptDate",
                days: -1
            }, function () {
                alert('Aw, you cut me to the quick!');
                $('#ratingsBox').hide();
            });
        });
        $('#btnRateLater').click(function() {
            chrome.extension.sendRequest({
                msg : "setNextRatingPromptDate",
                days: 7
            }, function () {
                $('#ratingsBox').hide();
            });
        });
         $('#btnRateNow').click(function() {
            chrome.extension.sendRequest({
                msg : "setNextRatingPromptDate",
                days: -1
            }, function () {
                window.open('https://chrome.google.com/webstore/detail/better-text-viewer/lcaidopdffhfemoefoaadecppnjdknkc/reviews', '_blank');
                $('#ratingsBox').hide();
            });
        });
        
        // Style the ratings box (bringing it forward)
        $('#ratingsBox').css({
            'z-index': 8999,
            'position': 'absolute',
            'right': '40px',
            'top': '20px',
            'width': '360px',
            'padding': '.5em 1em .5em 1em',
            'border': '1px solid gray',
            'background-color': 'white',
            'border-radius': '4px'
         });
        
        // Show the box
        $('#ratingsBox').show();
    }
}