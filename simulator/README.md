# LFU-Simulator

## 概要

LFU (Lambda-Function-URLs) をシミュレーションして、ローカル環境で実行できる環境を提供します.

なぜこれが必要なのかと言えば、LUFはAwsS3, Github上のコンテンツを Lambda関数URL機能から呼び出して実行しますが、この環境で `Webアプリを開発` しようとすると、動作確認の作業において、非常に `大変で面倒` な壁に突き当たります.

たとえばS3上のコンテンツを変更しようとすると以下の工程が必要となります.

1. コンテンツを変更.
2. コンテンツを所定のS3にUpdate.
3. ブラウザで確認.

一方、ローカル環境で試す場合は以下の工程が必要です.

1. コンテンツを変更.
2. ブラウザで確認.

内容的には１つの工程が無いだけのように見えますが、一方で `コンテンツを所定のS3にUpdate` これが「編集・確認作業」をする工程で、これらの頻度が増えるほど `大変で面倒` な作業となるわけで、この作業を開発を行う上で非常に「面倒」であるといえます.

また githubに至っては、この「確認・編集作業」の度に githubにコミットしてpushを「毎回行う」事になり、現実的な開発環境では無いでしょう.

これら「開発環境」において、LFUを用いると非常に `大変で面倒` なものを回避するのが `LFU-Simulator` です.

LFU-Simuratorを利用して、安価で手軽なLFUによる `軽量Webアプリケーション` の実現となります.

ただ、この環境はWindowsのCmdやPowerShellでの動作を考慮していない作りとなっています(パス関連の￥マーク等).

そのため、WindowsでLFU-Simuratorを利用する場合は `WSL2` 等のLinux環境を導入し、そちらから利用する事をおすすめします.

## LFU-Simuratorを使ってみよう

この項では、この LFU-Simuratorを使うに対して、どのような設定が必要であるかを具体的に説明していきたいと思います.

### LFU-Simulatorで必要な環境について

LFU-Simuratorで設定が必要なものは以下の通り.

1. LFU-Simurator環境をローカル環境に用意する.
2. LFUが読み込む、S3やgithubのコンテンツのローカル環境を用意する.
3. LFU-Simurator用の環境変数設定.
4. LFU用の環境変数設定.

まずは1のLfu-Simurator環境を用意します.

~~~sh
$ cd ~/
$ mkdir project
$ cd project
$ git clone git@github.com:maachang/lambda-func-url.git
$ ls
lambda-func-url
$
~~~

これでLFU-Simurator環境は準備できました.

次に２のローカルコンテンツ環境を用意します.<br>
この項では `github` 環境を主体として説明します.

~~~sh
$ cd ~/
$ mkdir project
$ cd project
$ git clone git@github.com:maachang/testLFU.git
$ ls
lambda-func-url  testLFU
$
~~~

これで `LFUが読み込む、S3やgithubのコンテンツのローカル環境` が準備できました.

次に３の `LFU-Simurator用の環境変数設定` を定義します.

これには２つの設定方法があります.

1. ~/.bash_profile 等で環境変数を設定する.
2. lfu.env.json ファイルで設定する.

どちらでも設定可能ですが、私としては項２をおすすめします.<br>
と言うのも、この機能には「暗号化」があるので、AWSのクレデンシャル情報等センシティブな内容も担保する事ができるのと、チーム開発において「一々個別に多くの環境変数を設定する」のは面倒な点があります.

次に４の `LFU用の環境変数設定` も３と同じものを使う事をおすすめします.

その理由として `lfu.env.json` の雛形には、３と４の内容が含まれているからで、次にこの内容について説明していきます.

### LFU-Simuratorの環境変数 `lfu.env.json` 説明

先程cloneした `testLFU` の直下に、ファイル `lfu.env.json` と言うものがあるので、これを展開してみます.

~~~json
{
    "//": "#######################################################",
    "//": "# lfu simurator用の環境変数設定",
    "//": "# AWSのクレデンシャルを含む場合は、lfusimコマンドで",
    "//": "# 暗号化してください.",
    "//": " > lfusim --encode --key {cipherKey} --pass {cipherPass}",
    "//": "#######################################################",

    "//": "[任意]Awsクレデンシャル.",
    "AWS_ACCESS_KEY_ID": null,
    "AWS_SECRET_ACCESS_KEY": null,
    "AWS_SESSION_TOKEN": null,
    
    "//": "#######################################################",
    "//": "# lfu側の環境変数",
    "//": "#######################################################",

    "//": "[必須]メインで利用するrequireやrequest先",
    "//": "  MAIN_EXTERNAL=s3: S3をメインで利用する場合",
    "//": "  MAIN_EXTERNAL=git: github repogitoryをメインで利用する場合",
    "MAIN_EXTERNAL": "git",
    
    "//": "[必須]request時のカレントパス設定",
    "//":   "REQUEST_PATH=currentPath",
    "REQUEST_PATH": "public",

    "//": "[simuratorの場合不要]s3require, s3request時の接続設定",
    "//":   "S3_CONNECT='requirePath, region'",
    "S3_CONNECT": null,

    "//": "[simuratorの場合不要]grequire, grequest時の接続設定",
    "//":   "GIT_CONNECT='organization, repo, branch, requirePath, token'",
    "GIT_CONNECT": null,

    "//": "[simuratorの場合不要]grequire, grequestのキャッシュタイムアウト値",
    "CACHE_TIMEOUT": null,

    "//": "[simuratorの場合不要]grequire, grequestのキャッシュを行わない場合設定します",
    "NONE_GZIP": null,

    "//": "[任意]MAINS3バケット名.",
    "MAIN_S3_BUCKET": "lfu-bucket",

    "//": "[任意]filterFunc読み込み先を指定",
    "//":   "exrequire読み込みのcurrentPath=''での定義を行います",
    "FILTER_FUNCTION": "init/filterFunc.js",

    "//": "[任意]originMime読み込み先を指定",
    "//":   "exrequire読み込みのcurrentPath=''での定義を行います",
    "ORIGIN_MIME": null,

    "//": "#######################################################",
    "//": "# lfu-simurator側の環境変数",
    "//": "#######################################################",

    "//": "[必須]LFUローカルパス",
    "//":   "Lambdaで利用するLFUSetup.jsとindex.jsが存在するパスを設定",
    "LFU_PATH": "${HOME}/project/lambda-func-url/src",

    "//": "[任意]偽S3のローカルパス",
    "LFU_FAKE_S3_PATH": null,

    "//": "[任意]偽gitのローカルパス",
    "LFU_FAKE_GITHUB_PATH": "${HOME}/project/testLFU",

    "//": "[simuratorの場合外部設定]Env定義Confファイル名.つまりこのファイルを指定します",
    "//": "拡張子を除いて設定",
    "//": "設定しない場合は`lfusim`コマンドで実行時のパス上の`lfu`が対象となります",
    "LFU_ENV_CONF": null,

    "//": "[任意]HTTPでのcros許可設定",
    "//":   "LFU_HTTP_CROS_MODE: 'true' で許可",
    "LFU_HTTP_CROS_MODE": null,

    "//": "[simuratorの場合外部設定]lfuコンフィグを暗号・復号するキー条件のKey条件",
    "LFU_CIPHOER_KEY": null,

    "//": "[simuratorの場合外部設定]lfuコンフィグを暗号・復号するキー条件のPass条件",
    "LFU_CIPHOER_PASS": null,

    "//": "[任意]loggerディレクトリ",
    "//":   "指定なしの場合カレントの`conf`",
    "LFU_LOGGER_DIR": null,

    "//": "[任意]loggerファイルヘッダ名",
    "//":   "LFU_LOGGER_NAME=log の場合 `log-{yyyy-MM}.log`",
    "LFU_LOGGER_NAME": null,

    "//": "[任意]loggerファイル出力レベル",
    "//":   "none or trace: 規制なし",
    "//":   "deg or debug: debug以上",
    "//":   "info: info以上",
    "//":   "warn or warning: warning以上",
    "//":   "err or error: error以上",
    "//":   "指定しない場合はdebug",
    "LFU_LOGGER_LEVEL": null
}
~~~

`lfu.env.json`では、コメント説明がありますが、具体的な内容説明を以降より行っていきます.


