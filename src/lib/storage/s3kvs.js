///////////////////////////////////////////////////////////////////////
// S3のKeyValueStorage構造を利用したKeyValue情報管理を行います.
// AWSのS3は、基本的にKeyValue形式です.
// 
// AWSのS3は、容量単価として 1TByteで 約25$(東京リージョン)と非常に安い.
// ただS3の1blockが128kbyte単位なので、1byteであっても最低128kbyteとなる.
// しかし1TByteで月25$なので、128kbyteの1オブジェクトは 月$0.0000025 と
// 非常に安価だ(たとえば10万データ=$0.25=1USD:140円で月額約35円)
// s3のI/O料金はGET=($0.0037/10,000req) それ以外=($0.0047/1,000req)
//
// 一方でRDSを使った場合最低(mysql, t3-micro, 20Gbyteの１台で月額約3000円
// ちょい)とバージョンアップ等のメンテナンス費用やレプリケーション等、
// 非常に高くついてしまう.
//
// ある程度使いやすいS3を使ったKeyValue形式のものを作成する事で、非常に
// 安価なデータ管理が行える仕組みが作れる可能性があると言えます.
///////////////////////////////////////////////////////////////////////
(function() {
'use strict'

// frequireが設定されていない場合.
let frequire = global.frequire;
if(frequire == undefined) {
    // frequire利用可能に設定.
    require("../../freqreg.js");
    frequire = global.frequire;
}

// s3restApi.
const s3 = frequire("./lib/s3restApi.js");

// convb.
const convb = frequire("./lib/storage/convb.js");

// [ENV]メインS3バケット.
const ENV_MAIN_S3_BUCKET = "MAIN_S3_BUCKET";

// [ENV]S3Kvs-Prefix.
const ENV_S3_KVS_PREFIX = "S3_KVS_PREFIX";

// デフォルトのプレフィックス.
const DEFAULT_PREFIX = "s3kvs";

// list取得での１度での最大リスト数.
const MAX_LIST = 100;

// key, valueインデックスに対するvalue文字列最大値.
const MAX_INDEX_VALUE_LENGTH = 64;

// S3KVS拡張子.
const S3KVS_EXTENSION = ".s3kvs";

// S3KVS拡張子長.
const S3KVS_EXTENSION_LENGTH = S3KVS_EXTENSION.length;

// convb => jsonbエンコード.
const convbEncode = function(value) {
    const bin = [];
    convb.encodeValue(bin, value);
    return Buffer.from(bin);
}

// convb => jsonbデコード.
const convbDecode = function(bin) {
    const pos = [0];
    return convb.decodeValue(pos, bin);
}

// base64の最後の=を削除.
const cutBase64ToLastEq = function(value) {
    value = Buffer.from(value).toString('base64');
    const len = value.length;
    // base64の最後の`=`を除外.
    for(var i = len - 1; i >= 0; i --) {
        if(value[i] != "=") {
            value = value.substring(0, i + 1);
            break;
        }
    }
    return value;
}

// インデックスである `~base64(Key)~base64(value)` の条件を取得.
// key 対象のkeyを設定.
// value value条件を設定します.
// 戻り値: `~base64(Key)~_[N]base64(value)`が返却されます.
const encodeKeyValue = function(key, value) {
    // valueが存在しない場合.
    if(value == null || value == undefined) {
        value = "";
    // value情報が存在する場合.
    } else {
        const t = typeof(value);
        // boolean型.
        if(t == "boolean") {
            value = "_b" +
                (value == true ? "T" : "f");
        } else if(t == "number") {
            const b = [];
            if(convb.isFloat(value)) {
                // 浮動小数点変換.
                convb.encodeFloat(b, value);
                value = "_f";
            } else {
                // 整数変換.
                convb.encodeLong(b, value);
                value = "_n";
            }
            // binaryをbase64変換.
            value += cutBase64ToLastEq(b);
        // 日付型の場合.
        } else if(value instanceof Date) {
            const b = [];
            // 整数変換.
            convb.encodeLong(b, value.getTime());
            // binaryをbase64変換.
            value = "_d" + cutBase64ToLastEq(b);
        // その他.
        } else {
            // 文字列として扱う.
            value = "" + value;
            if(value.length >= MAX_INDEX_VALUE_LENGTH) {
                throw new Error(
                    "The string length of index value" +
                    " exceeds the maximum value (" +
                    MAX_INDEX_VALUE_LENGTH + ").")
            }
            // 文字列の場合_[N]はセットしない.
            value = cutBase64ToLastEq(value);
        }
    }
    // ~base64(Key)~base64(value)
    return "~" +
        cutBase64ToLastEq("" + key) +
        "~" +
        value;
}

// "~base64(Key)~base64(value)" を {key: value}変換する.
// keyValue 対象のkeyValue(string)を設定します.
// 戻り値: {key: value}が返却されます.
const decodeKeyValue = function(keyValue) {
    // s3kvs拡張子が設定されている場合.
    if(keyValue.endsWith(S3KVS_EXTENSION)) {
        keyValue = keyValue.substring(
            0, keyValue.length -
                S3KVS_EXTENSION_LENGTH);
    }
    // 単一のKeyを取得.
    keyValue = keyValue.split("~");
    // valueを解析.
    let value = keyValue[2];
    if(value.length > 0) {
        // 型定義が存在する場合.
        if(value.startsWith("_")) {
            const type = value.substring(0, 2);
            value = value.substring(2);
            if(type == "_b") {
                // boolean T=true, f=false.
                value = value == "T";
            } else {
                // ポジション.
                const p = [0];
                // base64を解析.
                value = Buffer.from(value ,'base64');
                if(type == "_f") {
                    // 浮動小数点.
                    value = convb.decodeFloat(p, value);
                } else if(type == "_n") {
                    // 整数.
                    value = convb.decodeLong(p, value);
                } else if(type == "_d") {
                    // Dateオブジェクト.
                    value = new Date(
                        convb.decodeLong(p, value));
                } else {
                    throw new Error(
                        "Unknown type condition: " + type);
                }
            }
        } else {
            // 文字列の場合.
            value = Buffer.from(value ,'base64')
                .toString()
        }
    }
    return {
        key: Buffer.from(keyValue[1], 'base64')
            .toString(),
        value: value
    }
}

// decodeKeyValue でリスト変換.
// list s3restApi.listObjectsでの取得結果をセット.
// 戻り値: [{key: value} ... ] が返却される.
const decodeKeyValueList = function(list) {
    let p;
    const len = list.length;
    for(let i = 0; i < len; i ++) {
        p = list[i].lastIndexOf("/");
        if(p == -1) {
            throw new Error(
                "Invalid path condition: " +
                list[i]);
        }
        list[i] = decodeKeyValue(
            list[i].substring(p + 1));
    }
    return list;
}

// S3パラメータを作成.
// bucketName s3バケット名を設定します.
// prefixName s3プレフィックス名を設定します.
// tableName 対象のテーブル名を設定します.
// index 対象のindex群 {key: value .... } を設定します.
//        この条件はキーソートされてprefix文字列化されます.
// key 対象のkey {key: value} を設定します.
//     設定しない場合はKey情報は取得されません.
// 戻り値: S3パラメータが返却されます.
const getS3Params = function(
    bucketName, prefixName, tableName, index, key) {
    // Keyの最初のキー名を取得.
    let topKey = null;
    // keyが設定されてる場合.
    if(key != undefined && key != null) {
        // topKeyを取得.
        for(let k in key) {
            topKey = k;
            break;
        }
        // topKeyが取得できない.
        if(topKey == null) {
            throw new Error("key condition is not set.");
        }
    }
    // パスを取得.
    // 基本prefixが存在しない.
    let path = null;
    if(prefixName == undefined || prefixName == null) {
        path = tableName;
    // 基本prefixが存在する.
    } else {
        path = prefixName + "/" + tableName;
    }
    // index条件を文字列化.
    if(index != undefined && index != null) {
        let count = 0;
        let list = [];
        for(let k in index) {
            list[count ++] = encodeKeyValue(
                k, index[k]);
        }
        // index = zeroの場合はエラー.
        if(count == 0) {
            throw new Error("No index key is set");
        }
        // インデックスソートしてパスに追加.
        list.sort();
        let len = list.length;
        for(let i = 0; i < len; i ++) {
            path += "/" + list[i];
        }
        list = null;
    }
    // keyが設定されている場合は変換.
    if(topKey != null) {
        key = encodeKeyValue(topKey, key[topKey]) +
            S3KVS_EXTENSION;
    } else {
        key = undefined;
    }
    // BucketとprefixとKeyを登録.
    return {Bucket: bucketName, Prefix: path, Key: key};
}

// オブジェクト生成処理.
// options {bucket: string, prefix: string, region: string}
//   - bucket 対象のS3バケット名を設定します.
//     未設定(undefined)の場合、環境変数 "MAIN_S3_BUCKET" 
//     で設定されてるバケット名が設定されます.
//   - prefix 対象のプレフィックス名を設定します.
//     未設定(undefined)の場合、prefixは""(空)となります.
//   - region 対象のリージョンを設定します.
//     未設定(undefined)の場合東京リージョン(ap-northeast-1)
//     が設定されます.
//   - credential AWSクレデンシャルを設定します.
//     {accessKey: string, secretAccessKey: string,
//       sessionToken: string}
//      - accessKey アクセスキーが返却されます.
//      - secretAccessKey シークレットアクセスキーが返却されます.
//      - sessionToken セッショントークンが返却されます.
//                  状況によっては空の場合があります.
const create = function(options) {
    // 基本バケット名.
    let bucketName = null;

    // 基本プレフィックス名.
    let prefixName = null;

    // リージョン名.
    let regionName = null;

    // クレデンシャル.
    let credential = null;

    // optionsが設定されていない場合.
    if(options == undefined || options == null) {
        options = {};
    }

    // bucket名が設定されていない.
    if(typeof(options.bucket) != "string") {
        // バケットから空セット.
        // 環境変数から取得.
        options.bucket = process.env[ENV_MAIN_S3_BUCKET];
        if(options.bucket == null || options.bucket == undefined ||
            options.bucket.length == 0) {
            throw new Error("Bucket name is empty.");
        }
    } else {
        // bucket名の整形.
        let flg = false;
        options.bucket = options.bucket.trim();
        // s3:// などの条件が先頭に存在する場合.
        let p = options.bucket.indexOf("://");
        if(p != -1) {
            // 除外.
            options.bucket = bucket.substring(p + 3);
            flg = true;
        }
        // 終端の / が存在する場合.
        if(options.bucket.endsWith("/")) {
            // 除外.
            options.bucket = options.bucket.substring(0, bucket.length - 1);
            flg = true;
        }
        // 除外があった場合trimをかける.
        if(flg) {
            options.bucket = bucket.trim();
        }
    }

    // prefixの整形.
    if(typeof(options.prefix) != "string") {
        // バケットから空セット.
        // 環境変数から取得.
        options.prefix = process.env[ENV_S3_KVS_PREFIX];
        if(options.prefix == null || options.prefix == undefined ||
            options.prefix.length == 0) {
            // 設定されていない場合.
            options.prefix = undefined;
        }
    }
    // prefixが存在する場合.
    if(typeof(options.prefix) == "string") {
        options.prefix = options.prefix.trim();
        if(options.prefix.startsWith("/")) {
            if(options.prefix.endsWith("/")) {
                options.prefix = options.prefix.substring(
                    1, options.prefix.length - 1).trim();
            } else {
                options.prefix = options.prefix.substring(1).trim();
            }
        } else if(options.prefix.endsWith("/")) {
            options.prefix = options.prefix.substring(
                0, options.prefix.length - 1).trim();
        }
    }

    // メンバー変数条件セット.
    bucketName = options.bucket;
    prefixName = options.prefix == undefined ?
        DEFAULT_PREFIX : options.prefix;
    regionName = options.region;
    credential = options.credential;
    options = undefined;

    // put.
    // tableName 対象のテーブル名を設定します.
    // path インデックスパス群 [{key: value} ...]を設定します.
    //      この値はkey名でソートされます.
    // keys インデックスキー {key: value ... } を設定します.
    // value 出力する内容(json)を設定します.
    // 戻り値: trueの場合設定に成功しました.
    const put = async function(tableName, path, key, value) {
        const pm = getS3Params(
            bucketName, prefixName, tableName, path, key);
        value = convbEncode(value);
        const response = {};
        await s3.putObject(
            response, regionName, pm.Bucket, 
            pm.Prefix + "/" + pm.Key, value,
            credential);
        return response.status <= 299;
    }

    // get.
    // tableName 対象のテーブル名を設定します.
    // path インデックスパス群 [{key: value} ...]を設定します.
    //      この値はkey名でソートされます.
    // keys インデックスキー {key: value ... } を設定します.
    // 戻り値: 検索結果(json)が返却されます.
    //         情報取得に失敗した場合は null が返却されます.
    const get = async function(tableName, path, key) {
        const pm = getS3Params(
            bucketName, prefixName, tableName, path, key);
        const response = {};
        const bin = await s3.getObject(
            response, regionName, pm.Bucket,
            pm.Prefix + "/" + pm.Key,
            credential);
        return response.status >= 400 ?
            null: convbDecode(bin);
    }

    // remove.
    // tableName 対象のテーブル名を設定します.
    // path インデックスパス群 [{key: value} ...]を設定します.
    //      この値はkey名でソートされます.
    // keys インデックスキー {key: value ... } を設定します.
    // 戻り値: trueの場合削除に成功しました.
    const remove = async function(tableName, path, key) {
        const pm = getS3Params(
            bucketName, prefixName, tableName, path, key);
        const response = {};
        await s3.deleteObject(
            response, regionName, pm.Bucket,
            pm.Prefix + "/" + pm.Key,
            credential);
        return response.status <= 299;
    }

    // 指定位置のリスト一覧を取得.
    // tableName 対象のテーブル名を設定します.
    // path インデックスパス群 [{key: value} ...]を設定します.
    //      この値はkey名でソートされます.
    // max １ページの最大表示数を設定.
    //     100件を超える設定はできません.
    // page ページ数を設定します.
    //      先頭から取得するので、ページ数が多いと「速度低下」に
    //      繋がるので注意が必要です.
    // 戻り値: [{key: value} ... ]
    //        指定したpath位置以下のobject名のkeyValue群が返却されます.
    const list = async function(tableName, path, max, page) {
        max = max|0;
        page = page|0;
        // １度に取得できる最大リスト件数の範囲外の場合.
        if(max <= 0 || max > MAX_LIST) {
            if(max <= 0) {
                throw new Error(
                    "The number of lists is set to zero.");
            }
            throw new Error("The maximum number of lists (" +
                MAX_LIST + ") has been exceeded.");
        // ページ番号が正しくない場合.
        } else if(page <= 0) {
            throw new Error(
                "The number of pages is set to zero.");
        }
        // 実行パラメータを生成.
        const pm = getS3Params(
            bucketName, prefixName, tableName, path);
        // 利用条件をセット.
        const bucket = pm.Bucket;
        const prefix = pm.Prefix;
        let cnt = 1;
        let res = null;
        let ret = null;
        // １ページの取得条件を設定.
        //  - １回の取得は max.
        //  - 対象のprefixのみ検索.
        //  - Key名のみ取得.
        const opt = {maxKeys: max, delimiter: "/" + prefix, keyOnly: true};
        while(true) {
            // response情報.
            res = {};
            // 対象のリストを取得.
            ret = await s3.listObject(
                res, regionName, bucket, prefix, opt,
                credential);
            // ページ番号の場合.
            if(cnt >= page) {
                // 処理終了.
                break;
            }
            //  次の条件が存在しない場合.
            if(res.header[s3.NEXT_MARKER_NAME] != "true") {
                return null;
            }
            // 次の情報の準備.
            opt.marker = ret[ret.length - 1].key;
            ret = undefined;
            res = undefined;
            cnt ++;
        }
        // [{key: value} ... ]で返却.
        return decodeKeyValueList(ret);
    }

    // オブジェクト.
    const ret = {};

    // カレントテーブル条件を設定.
    // table 対象のテーブル名を設定します.
    // 戻り値: それぞれの処理が返却されます.
    ret.currentTable = function(tableName) {
        return {
            put: function(path, key, value) {
                return put(tableName, path, key, value);
            }
            ,get: function(path, key) {
                return get(tableName, path, key);
            }
            ,remove: function(path, key) {
                return remove(tableName, path, key);
            }
            ,list: function(path, max, page) {
                return list(tableName, path, max, page);
            }
        };
    }

    // カレントテーブル ＋ パス条件を設定.
    // tableName 対象のテーブル名を設定します.
    // path インデックスパス群 [{key: value} ...]を設定します.
    //      この値はkey名でソートされます.
    // 戻り値: それぞれの処理が返却されます.
    ret.currentTablePath = function(tableName, path) {
        return {
            put: function(key, value) {
                return put(tableName, path, key, value);
            }
            ,get: function(key) {
                return get(tableName, path, key);
            }
            ,remove: function(key) {
                return remove(tableName, path, key);
            }
            ,list: function(max, page) {
                return list(tableName, path, max, page);
            }
        };
    }

    // 固有設定.
    ret.put = put;
    ret.get = get;
    ret.remove = remove;
    ret.list = list;

    return ret;
}

/////////////////////////////////////////////////////
// 外部定義.
/////////////////////////////////////////////////////
exports.create = create;

})();
