//////////////////////////////////////////////////////////
// lambda-func-url の環境設定用セットアップ.
// 形としては、以下のような形で行います.
//
// index.js
// ------------------------------------------------------
// exports.handler async => {
//   return await require("./LFUSetup.js").setting(
//     // 設定パラメータ群.   
//   )(arguments);
// }
// ------------------------------------------------------
// と言う感じで定義することで、lambda-func-url のセットアップ
// を行い、正しく起動することができます.
//
//////////////////////////////////////////////////////////
(function(_g) {
'use strict'

// lambda-func-urlでの必須パラメータ定義についての"名前"定義.
// (Todo: ※必須パラメータ説明を記載)
const REQUIRED_KEYS = [
    // ここに必須パラメータを設定する.

];

// [Main]ハンドラー実行.
// lambda-func-url に対する実行処理(HTTP or HTTPS)が行われるので、
// ここでハンドラー実行処理を行う必要がある.
const _main_handler = function(event, contex, callback) {



};

// lambda-func-url実行の設定を行います.
// ここでlambda-func-urlに関する定義を行い、実行条件を整えます.
// args {} でのパラメータを設定します.
//      必須パラメータの設定が必要で、以下定義を行う必要があります.
//
// 戻り値: 実行される `exports.handler` の function 定義
//        function(event, context, callback)
//        が返却されます.
const setting = function(args) {




    return _main_handler;
}

})(global);
