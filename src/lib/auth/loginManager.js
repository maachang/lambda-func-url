//////////////////////////////////////////
// ログインマネージャー.
//////////////////////////////////////////
(function(_g) {
'use strict'

// frequireが設定されていない場合.
let frequire = global.frequire;
if(frequire == undefined) {
    // frequire利用可能に設定.
    require("../../freqreg.js");
    frequire = global.frequire;
}

// S3KevValueStorage.
const s3kvs = frequire("./lib/storage/s3kvs.js");

// デフォルトのS3Kvs.
const defS3Kvs = s3kvs.create();

// ログインユーザテーブル.
const userTable = defS3Kvs.currentTable("loginUser");

// セッションログイン管理テーブル.
const sessionTable = defS3Kvs.currentTable("loginSession");






})(global);