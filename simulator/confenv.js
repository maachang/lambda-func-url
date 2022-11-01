/////////////////////////////////////////////////////
// ローカルファイルのenv定義を対応confファイルで反映する.
/////////////////////////////////////////////////////
(function(_g) {
'use strict';

// fs.
const fs = require("fs");

// constants.
const cons = require("./constants.js");

// fcipher.
const cip = require("./modules/fcipher.js");

// util.
const util = require("./modules/util/util.js");

// 未暗号のファイル拡張子.
const DEF_EXTENSION = ".env.json";

// 暗号済みのファイル拡張子.
const CIPHER_EXTENSION = ".envc.base64";

// 環境変数から除外する内容.
const EXCLUDED_KEY = "//";

// 終端の=を取る.
const catLastEq = function(n) {
    const len = n.length;
    for(let i = len-1; i >= 0; i --) {
        if(n.charAt(i) != '=') {
            return n.substring(0, i + 1);
        }
    }
    return "";
}

// ファイル存在を取得.
// name 対象のファイル名を設定します.
// 戻り値: trueの場合、存在します.
const isFile = function(name) {
    try {
        return fs.statSync(name).isFile();
    } catch(e) {
        return false;
    }
}

// confEnvを暗号化するためのkeyコードを生成.
// このコードはランダムな値で生成されます.
// 引数はあくまで「乱数のヒント」となります.
// key 対象の文字列を設定します.
// pass 対象のパスを設定します.
// 戻り値: {key: string, pass: string}
// - key 対象のキーコードが設定されます.
// - pass 対象のパスコードが設定されます.
const getKeyCode = function(key, pass) {
    if(typeof(key) != "string") {
        key = "!@A$#%^&*()";
    }
    if(typeof(pass) != "string") {
        pass = "%^b*()!@#$";
    }
    // wordのキーとパスを生成.
    const resKey = [].concat(
        cip.fhash("_" + key, false), cip.fhash("@" + pass + "$", false));
    const resPass = [].concat(
        cip.fhash("$" + pass + "@", false), cip.fhash("_" + key, false));
    key = catLastEq(cip.benc(resKey, pass));
    key = key.substring(0, (key.length / 1.5)|0);
    // 戻り値.
    return {key: key,
        pass: catLastEq(cip.benc(resPass, key))};
}

// 指定confEnv情報を暗号化.
// value 暗号対象の confEnvを設定します.
// key 対象のキーコードを設定します.
// pass 対象のパスコードを設定します.
// 戻り値: 変換結果が返却されます.
const encodeCipher = function(value, key, pass) {
    if(value instanceof Buffer) {
        value = value.toString();
    }
    if(typeof(value) != "string") {
        throw new Error("The cryptographic target does not exist.");
    } else if(typeof(key) != "string" || typeof(pass) != "string") {
        throw new Error(
            "The key or value to be encrypted does not exist.")
    }
    return cip.enc(value, cip.key(key, pass));
}

// 指定confEnv情報を復号化.
// value 暗号対象の confEnvを設定します.
// key 対象のキーコードを設定します.
// pass 対象のパスコードを設定します.
// 戻り値: 変換結果が返却されます.
const decodeCipher = function(value, key, pass) {
    if(value instanceof Buffer) {
        value = value.toString();
    }
    if(typeof(value) != "string") {
        throw new Error("The decryption target does not exist.");
    } else if(typeof(key) != "string" || typeof(pass) != "string") {
        throw new Error(
            "The key or value to be decrypted does not exist.")
    }
    return cip.dec(value, cip.key(key, pass));
}

// ファイルをロード.
// fileName対象のファイル名を設定します.
const loadFile = function(fileName) {
    if(typeof(fileName) != "string") {
        throw new Error("filename does not exist.")
    }
    return fs.readFileSync(fileName);
}

// 環境変数に登録するキーが除外キーかチェック.
const isExcludedKeys = function(key) {
    return EXCLUDED_KEY == key;
}

// ロードConfEnvを反映.
// file 対象のConfEnvファイル内容を設定します.
const flushConfEnv = function(file) {
    if(file instanceof Buffer) {
        file = file.toString();
    }
    if(typeof(file) != "string") {
        throw new Error("file content does not exist.")
    }
    file = JSON.parse(file);
    for(let k in file) {
        if(isExcludedKeys(k) ||
            file[k] == null || file[k] == undefined) {
            continue;
        }
        process.env[k] = file[k];
    }
}

// confEnvファイルが存在するかチェック.
// name 対象のファイル名(拡張子抜き)を設定します.
// extension 拡張子を設定します.
//           設定なしか対象拡張子一致の場合は見つかった条件が
//           返却されます.
// 戻り値: ファイルタイプが返却されます.
//        -1の場合、見つかりませんでした.
//        0の場合、未暗号のconfEnvです.
//        1の場合、暗号のconfEnvです.
const getConfEnvNameType = function(name, extension) {
    if(typeof(name) != "string") {
        return -1; // なし.
    }
    if(isFile(name + DEF_EXTENSION)) {
        if(typeof(extension) != "string" ||
            extension == DEF_EXTENSION) {
            return 0; // 非暗号.
        }
    }
    if(isFile(name + CIPHER_EXTENSION)) {
        if(typeof(extension) != "string" ||
            extension == CIPHER_EXTENSION) {
            return 1; // 暗号.
        }
    }
    return -1; // なし.
}

// confEnvファイルをロード.
// fileName 対象のconfEnv(拡張子抜き)を設定します.
// key 対象のキーコードを設定します.
// pass 対象のパスコードを設定します.
const loadConfEnv = function(fileName, key, pass) {
    // ファイル名が存在しない/ファイルが存在しない場合
    // 環境変数から取得.
    if(getConfEnvNameType(fileName) == -1) {
        // 環境変数から取得.
        fileName = util.getEnv(cons.ENV_TO_CONF_ENV_NAME);
        if(getConfEnvNameType(fileName) == -1) {
            // カレントにあるconfenv定義を取得.
            fileName = cons.DEF_CONF_ENV_NAME;
            if(getConfEnvNameType(fileName) == -1) {
                // 見つからない場合処理しない.
                return;
            }
        }
    }
    // 暗号化されたconfEnvが存在する場合.
    if(isFile(fileName + CIPHER_EXTENSION)) {
        // 暗号キーやパスが存在しない場合環境変数から取得.
        if(typeof(key) != "string" || typeof(pass) != "string") {
            key = util.getEnv(cons.ENV_CIPHER_KEY);
            pass = util.getEnv(cons.ENV_CIPHER_PASS);
        }
        const file = loadFile(fileName + CIPHER_EXTENSION);
        file = decodeCipher(file, key, pass);
        flushConfEnv(file);
    // 非暗号化のconfEnvが存在する場合.
    } else if(isFile(fileName + DEF_EXTENSION)) {
        const file = loadFile(fileName + DEF_EXTENSION);
        flushConfEnv(file);
    // 存在しない場合.
    } else {
        throw new Error("Specified name '" +
            fileName + "' is not a confEnv file.");
    }
}

// confEnvファイルを暗号化.
// fileName 対象のconfEnv(拡張子抜き)を設定します.
// key 対象のキーコードを設定します.
// pass 対象のパスコードを設定します.
// 戻り値: {src: string, dest: string}
//         - src 変換元のファイル名が設定されます.
//         - dest 変換先のファイル名が設定されます.
const encodeCipherConfEnv = function(fileName, key, pass) {
    if(fileName == undefined || fileName == null) {
        throw new Error("File name not set.");
    }
    // ファイル名が存在しない/ファイルが存在しない場合
    // 環境変数から取得.
    if(getConfEnvNameType(fileName, DEF_EXTENSION) == -1) {
        // 環境変数から取得.
        fileName = util.getEnv(cons.ENV_TO_CONF_ENV_NAME);
        if(getConfEnvNameType(fileName, DEF_EXTENSION) == -1) {
            // カレントにあるconfenv定義を取得.
            fileName = cons.DEF_CONF_ENV_NAME;
            if(getConfEnvNameType(fileName, DEF_EXTENSION) == -1) {
                // 見つからない場合エラー.
                throw new Error("The target file name does not exist.");
            }
        }
    }
    let file = loadFile(fileName + DEF_EXTENSION);
    // 暗号キーやパスが存在しない場合環境変数から取得.
    if(typeof(key) != "string" || typeof(pass) != "string") {
        key = util.getEnv(cons.ENV_CIPHER_KEY);
        pass = util.getEnv(cons.ENV_CIPHER_PASS);
    }


    // 暗号化.
    file = encodeCipher(file, key, pass);
    // 暗号化拡張子で保存する.
    fs.writeFileSync(fileName + CIPHER_EXTENSION, file);
    return {
        src: fileName + DEF_EXTENSION,
        dest: fileName + CIPHER_EXTENSION
    };
}

// 暗号化したconfEnvファイルを復号化.
// fileName 対象のconfEnv(拡張子抜き)を設定します.
// key 対象のキーコードを設定します.
// pass 対象のパスコードを設定します.
// 戻り値: {src: string, dest: string}
//         - src 変換元のファイル名が設定されます.
//         - dest 変換先のファイル名が設定されます.
const decodeCipherConfEnv = function(fileName, key, pass) {
    // ファイル名が存在しない/ファイルが存在しない場合
    // 環境変数から取得.
    if(getConfEnvNameType(fileName, CIPHER_EXTENSION) == -1) {
        // 環境変数から取得.
        fileName = util.getEnv(cons.ENV_TO_CONF_ENV_NAME);
        if(getConfEnvNameType(fileName, CIPHER_EXTENSION) == -1) {
            // カレントにあるconfenv定義を取得.
            fileName = cons.DEF_CONF_ENV_NAME;
            if(getConfEnvNameType(fileName, CIPHER_EXTENSION) == -1) {
                // 見つからない場合エラー.
                throw new Error("The target file name does not exist.");
            }
        }
    }
    let file = loadFile(fileName + CIPHER_EXTENSION);
    // 暗号キーやパスが存在しない場合環境変数から取得.
    if(typeof(key) != "string" || typeof(pass) != "string") {
        key = util.getEnv(cons.ENV_CIPHER_KEY);
        pass = util.getEnv(cons.ENV_CIPHER_PASS);
    }
    // 復号化.
    file = decodeCipher(file, key, pass);
    // confEnv拡張子で保存する.
    fs.writeFileSync(fileName + DEF_EXTENSION, file);
    return {
        src: fileName + CIPHER_EXTENSION,
        dest: fileName + DEF_EXTENSION
    };
}

/////////////////////////////////////////////////////
// 外部定義.
/////////////////////////////////////////////////////
exports.getKeyCode = getKeyCode;
exports.loadConfEnv = loadConfEnv;
exports.encodeCipherConfEnv = encodeCipherConfEnv;
exports.decodeCipherConfEnv = decodeCipherConfEnv;

})(global);