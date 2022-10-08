///////////////////////////////////////////////////////////
// AWS S3 REST API実装.
// aws sdk(v2) for javascriptだと、Lambdaコールドスタート時に
// おいて、読み込みに5000ミリ秒以上かかる.
// 代替えとして、S3 向けの REST APIが提供されているので、この
// 機能を利用してS3バケットのI/Oを行う.
///////////////////////////////////////////////////////////
(function(_g) {
'use strict'

// frequire が 定義されていない場合
if(frequire == undefined) {
    // requireをセット(単体テスト用.)
    frequire = require;
}

// REST API先の基本URLを取得.
const getBaseUrl = function(region) {
    if(region == undefined || region == null) {
        region = "ap-northeast-1";
    }
    return "https://s3-" + region + ".amazonaws.com";
} 

// ターゲットURLを生成.
const targetUrl = function(bucket, region) {
    if(region == undefined || region == null) {
        region = "ap-northeast-1";
    }
    return bucket + "s3." + region + ".amazonaws.com";
}

})(global);