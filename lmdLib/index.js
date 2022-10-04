//////////////////////////////////////////////////////////
// lambda main.
// 対象のLambdaのindex.jsを置き換えてください.
//////////////////////////////////////////////////////////
(function(_g) {
'use strict'

// lambda main.
exports.handler = async (event, context) => {
    return await (require("./LFUSetup.js").start())
        (event, context);
};

})();
