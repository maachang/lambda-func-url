///////////////////////////////////////////////
// slack-web-hook ユーティリティ.
///////////////////////////////////////////////
(function() {
'use strict'

// https.
const https = require("https");

// 文字エンコード.
const _TEXT_ENCODE = new TextEncoder();

// JSON情報をPOST送信.
// url 送信先URLを設定します.
// json 送信対象のJSON情報を設定します.
// 戻り値: HTTPレスポンスBodyが返却されます.
const sendHttpJson = async function(url, json) {
    // UTF8バイナリ変換.
    if(typeof(json) == "string") {
        json = _TEXT_ENCODE.encode(json);
    }
    // httpClient(https).
    return new Promise((resolve, reject) => {
        try {
            // request作成.
            const req = https.request(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": ("" + json.length),
                    "X-Header": "X-Header"
                }
            }, (res) => {
                // httpステータスエラーの場合.
                if(res.statusCode >= 400) {
                    reject(new Error("status: " + res.statusCode +
                        " messaeg: " + res.statusMessage));
                    return;
                }
                // response処理.
                try {
                    res.setEncoding("utf8");
                    let body = "";
                    res.on("data", (chunk)=>{
                        body += chunk;
                    });
                    res.on("end", ()=>{
                        resolve(body);
                    });
                    res.on("error", reject);
                } catch (err) {
                    reject(err)
                }
            });
            // request処理.
            req.on('error', reject);
            req.write(json);
            req.end();
        } catch (err) {
            reject(err)
        }
    });
}

// [text]メッセージ送信.
// url slackのWebHookで提示されたURLを設定します.
// message 送信メッセージを設定します.
// options その他装飾等を行う場合は、ここに設定します.
// 戻り値: "ok" で正しく送信されました.
const sendText = function(url, message, options) {
    // Array形式の場合は、改行をセットして文字列化.
    if(Array.isArray(message)) {
        let n = "";
        const len = message.length;
        for(let i = 0; i < len; i ++) {
            if(i != 0) {
                n += "\n";
            }
            n += message[i];
        }
        message = n;
    }

    // 基本送信データ.
    const body = {
        "text": message,
    };
    // option情報に条件が存在する場合.
    if(options != null && options != undefined) {
        for(let k in options) {
            body[k] = options[k];
        }
    }

    // 送信処理.
    return sendHttpJson(url, JSON.stringify(body));
}

// [JSON]メッセージ送信.
// url slackのWebHookで提示されたURLを設定します.
// json 送信JSONを設定します.
// 戻り値: "ok" で正しく送信されました.
const sendJSON = function(url, json) {
    // [JSON]送信処理.
    return sendHttpJson(url, JSON.stringify(json));
}


/////////////////////////////////////////////////////
// 外部定義.
/////////////////////////////////////////////////////
exports.sendText = sendText;
exports.sendJSON = sendJSON;

})();