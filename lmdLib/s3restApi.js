///////////////////////////////////////////////////////////
// AWS S3 REST API実装.
//
// aws sdk(v2) for javascriptだと、Lambdaコールドスタート時に
// おいて、読み込みに5000ミリ秒以上かかる.
//
// 代替えとして、S3 向けの REST APIが提供されているので、この
// 機能を利用してS3バケットのI/Oを行う.
///////////////////////////////////////////////////////////
(function(_g) {
'use strict'

// リージョンを取得.
// region 対象のregionを設定します.
// 戻り値: リージョンが返却されます.
const getRegion = function(region) {
    if(region == undefined || region == null) {
        region = "ap-northeast-1";
    }
    return region;
}

// s3Host名を生成.
// 仕様: https://{bucket}.s3.{region}.amazonaws.com/{prefix + object}.
// bucket 対象のバケット名を設定(string).
// region 対象のregionを設定(string).
// 戻り値: host名画返却.
const createS3Host = function(bucket, region) {
    return bucket + ".s3." + getRegion(region) +
        ".amazonaws.com";
}



})(global);