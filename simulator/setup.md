# LFU-Simulatorを利用するためのセットアップについて

※ ここではnodejs はインストール済みであることが前提です.<br>
またバージョンは `v14.8.0以降` がオススメです.<br>
理由として、NodeJsのコンソール実行において`TOP-Level await`が利用できるからです.<br>
https://qiita.com/n0bisuke/items/b2236f56437f71db8aff

※ またここでの設定は Linux(主にUbuntu)で行う場合の説明となっています.

## 環境変数に以下のフォルダのLFU_HOMEとPATHを設定する

~~~bash
export LFU_HOME=`simuratorの任意のPath`
export PATH=${LFU_HOME}/bin:${PATH}
~~~

これらを `~/.profile` などに設定する必要があります.

※ {simuratorのPath}は利用環境で展開されたシミュレータの相対パスを設定する.

## minifyコマンドをインストールする

これらは `minifiLfu` コマンドで必要となります.

uglify-js(npm)をインストールする.

~~~bash
npm -g install uglify-js
~~~

## zipコマンドをインストールする

これらは `minifiLfu` コマンドで必要となります.<br>
また、以下のコマンドはubuntu系の場合を前提となっています.

~~~bash
sudo apt install zip
~~~

これによって、シミュレータの実行や、LFUソースコードの圧縮やデプロイ最適化を行う事ができます.

