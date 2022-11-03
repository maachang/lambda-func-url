//////////////////////////////////////////////////////////
// lambda main.
//////////////////////////////////////////////////////////
(function() {
'use strict'

// lambda main.
exports.handler = async (event, context) => {
    // lambda上にfilter.jsが存在する場合、対象とする.
    let filter = undefined;
    try {
        filter = require("./filter.js");
    } catch(e) {
        filter = undefined;
    }
    // lambda上にmime.jsが存在する場合、対象とする.
    let mime = undefined;
    try {
        mime = require("./mime.js");
    } catch(e) {
        mime = undefined;
    }
    return await
        (require("./LFUSetup.js").start(event, filter, mime))
        (event, context);
};

})();
