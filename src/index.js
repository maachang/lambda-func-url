//////////////////////////////////////////////////////////
// lambda main.
//////////////////////////////////////////////////////////
(function() {
'use strict'

// lambda main.
exports.handler = async (event, context) => {
    return await
        (require("./LFUSetup.js").start(event))
        (event, context);
};

})();
