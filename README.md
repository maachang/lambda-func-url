# lambda-func-url

## 概要

AWSのLambdaにおいて昨今(2022年ちょっと)から `関数URL` と言うものがサポートされ、これにより `AWS-Gateway` + `Lambda` の定義を必要とせずに URLから当該Lambdaが呼び出せると言う仕組みが提供されている.

詳しくは、以下のように

### [関数URLの仕様内容](https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/lambda-urls.html)

> https：//{関数URLのID}.lambda-url.{region}.on.aws

のような形のEND-POINTが設定できて、ブラウザ等から「パブリック」アクセスが実現できるものである。

これに伴い、以下のように対象のLambdaに `関数URL` を定義すると対象EndPointのURLが定義されるので以下のように

~~~js
exports.handler = function(event) {
    return {
        'statusCode': 200,
        'body': JSON.stringify(event, null, "  ");
    }
}
~~~

実装すると、アクセスしたブラウザ側に対して以下の内容が返却される。

### event

~~~json
{
  "version": "2.0",
  "routeKey": "$default",
  "rawPath": "/",
  "rawQueryString": "param1=hoge",
  "headers": {
    "x-amzn-trace-id": "Root=1-624efbbc-13cb25d619ceadfe0cb469bc",
    "x-forwarded-proto": "https",
    "host": "hogehoge.lambda-url.ap-northeast-1.on.aws",
    "x-forwarded-port": "443",
    "x-forwarded-for": "1.2.3.4",
    "accept": "*/*",
    "user-agent": "curl/7.68.0"
  },
  "queryStringParameters": {
    "param1": "hoge"
  },
  "requestContext": {
    "accountId": "anonymous",
    "apiId": "hogehoge",
    "domainName": "hogehoge.lambda-url.ap-northeast-1.on.aws",
    "domainPrefix": "hogehoge",
    "http": {
      "method": "GET",
      "path": "/",
      "protocol": "HTTP/1.1",
      "sourceIp": "1.2.3.4",
      "userAgent": "curl/7.68.0"
    },
    "requestId": "21e5f8ee-bf99-4643-8f19-386978967955",
    "routeKey": "$default",
    "stage": "$default",
    "time": "07/Apr/2022:14:57:00 +0000",
    "timeEpoch": 1649343420924
  },
  "isBase64Encoded": false
} 
~~~

こんな風に event から `"rawPath": "/"` のアクセスパス＋ファイル名が取れるので、たとえば定義された関数URLのURLに対して、当該設定されたLambdaの `関数URL` の後に指定されたURLが、ここから取得できるわけで、なので１つの `関数URL` を割り当てたLambdaに対して、この `event.rawPath` の挙動を１つのLambdaで差配できるわけで、これを「S3バケット+プレフィックスにあるコンテンツ」や、対象Githubリポジトリに直接アクセスできるようにすれば `serverless` なWebアプリ開発環境が便利で簡単にできる可能性がある.

なるべく `楽な形` で `serverless なframework` で `最小限の環境提供` たとえば、従来のserverless Frameworkを使うのではなく、terraformだけでLambdaの `serverless` 環境構築が実行できる形を作りたいと思う.

## lambda-func-urlの実装について

実装事態は非常に簡単で、作成時のAWS Lambda関数定義に対して以下のように実装する事で対応できる.

### index.js

~~~js
exports.handler async (event) => {
  return await (require("./LFUSetup.js").start())(event);
}
~~~

また `require("./LFUSetup.js").start(1, 2)` に対するパラメータは以下の内容が設定可能.

1. filterFunc<br>
  コンテンツ実行の事前処理を行いたい場合は設定する.<br>
  たとえば、何らかのアクセス認証を行いたい場合は、filterFuncを設定して行う.<br>
  仕様: `filterFunc = function(resStatus, resHeader, params)`<br>
    - resStatus: httpStatus.jsのオブジェクトが設定される.<br>
      HTTPレスポンスステータスが変更された場合(200以外)、filterFunc実行結果が有効となる.<br>
    - resHeader: httpHeader.jsのオブジェクトが設定される.<br>
    - params: LFUStatus.jsでのparamsが設定される.<br>

2. originMime<br>
  拡張MimeTypeを設定.<br>
  function(extends)が必要で、拡張子の結果に対して戻り値が {type: mimeType, gz: boolean}を返却する必要がある.<br>
  (対応しない場合は undefinedで設定しない).

次に `return await (require("./LFUSetup.js").start())(event);` で渡されたevent引数は以下のように、変換されて実行処理に設定される.

### params

~~~js
// AWSLambdaの関数URLパラメータから必要な内容を取得.
params = {
    // httpメソッド(GET, POSTなど).
    method: string
    // EndPointパス(/から始まるパス).
    ,path: string
    // リクエストヘッダ(httpHeader.jsオブジェクト).
    ,requestHeader: httpHeader
    // リクエストパラメータ(URLの?xxx=yyy&zzz=hoge...が解析された内容).
    ,requestParams: object
    // EndPoint(string)パスに対するファイルの拡張子.
    // undefinedの場合、js実行結果を返却させる.
    ,extension: string
    // 拡張子mimeType変換用(getMimeType(extension)).
    ,mimeType: function
    // 元のeventをセット.
    ,srcEvent: object
    // 設定された環境変数.
    ,env: object
};
~~~

これらの値が先程の `filterFunc(_, _, params)` や実行時のjsリクエスト(`handler(_, _, params)` or `execute(_, _, params)`) に渡される.

## 環境変数設定



