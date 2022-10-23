// 文字列系ユーティリティ.
//

(function (_g) {
'use strict';
const o = {};
const _u = undefined;

// nullチェック.
o.isNull = function(value) {
  return (value == _u || value == null);
}

// 文字存在チェック.
o.useString = (function() {
  const _USE_STR_REG = /\S/g;
  return function(str) {
    let s = str;
    if (o.isNull(s)) {
      return false;
    }
    if (typeof(s) != "string") {
      if (!o.isNull(s["length"])) {
        return s["length"] != 0;
      }
      s = "" + s;
    }
    return s.match(_USE_STR_REG) != _u;
  }
})();

// 文字列を置き換える.
o.changeString = function(base, src, dest) {
  base = "" + base;
  src = "" + src;
  dest = "" + dest;
  let old = base;
  let val = base;
  while (true) {
    val = val.replace(src,dest);
    if (old == val) {
      return val;
    }
    old = val;
  }
}

// コーテーションを検知しない、indexOf
o.indexNotCote = function(base, cc, off) {
  off = off|0;
  let c, res, i, j;
  let cote = -1;
  let bef = 0;
  let yenFlag = false;
  const len = base.length;
  const cLen = cc.length;
  for(i = off ; i < len ; i ++ ) {
    c = base.charAt(i);
    if( cote != -1 ) {
      if(bef != '\\' && c == cote) {
        yenFlag = false;
        cote = -1;
      }
      else if(c == '\\' && bef == '\\') {
        yenFlag = true;
      }
      else {
        yenFlag = false;
      }
    }
    else {
      if(bef != '\\' &&
        (c == '\'' || c == '\"')) {
        cote = c;
      }
      else if(c == cc.charAt(0)) {
        res = true;
        for(j = 1 ; j < cLen ; j ++) {
          if(i + j >= len ||
            cc.charAt(j) != base.charAt(i + j)) {
            res = false;
            break;
          }
        }
        if(res == true) {
          return i;
        }
      }
    }
    if(yenFlag) {
      yenFlag = false;
      bef = 0;
    }
    else {
      bef = c;
    }
  }
  return -1;
}

// 文字列のカット.
o.cutString = function(base, cc, pos) {
  pos = pos|0;
  let p;
  let b = pos;
  const ret = [];
  while(true) {
    if((p = o.indexNotCote(base, cc, b)) == -1) {
      if(b != base.length) {
        ret.push(base.substring(b));
      }
      break;
    } else {
      ret.push(base.substring(b,p));
    }
    b = p + cc.length;
  }
  return ret;
}

// 文字連結処理.
o.StrBuf = function(s) {
  const r = {v:""};
  r.create = function(n) {
    this.v = ""+n;
    return this;
  }
  r.clear = function() {
    this.v = "";
    return this;
  }
  r.ad = function(n) {
    this.v += n;
    return this;
  }
  r.ts = function() {
    return this.v;
  }
  r.len = function() {
    return this.v.length;
  }
  if(!o.isNull(s)) {
    r.create(s);
  }
  return r;
}

// UTF8文字列を、通常バイナリ(配列)に変換.
o.utf8ToBinary = function(n, off, len) {
  const lst = [];
  let cnt = 0;
  let c;
  len += off;
  for(let i = off ; i < len ; i ++) {
    c = n.charCodeAt(i)|0;
    if (c < 128) {
      lst[cnt++] = c|0;
    }
    else if ((c > 127) && (c < 2048)) {
      lst[cnt++] = (c >> 6) | 192;
      lst[cnt++] = (c & 63) | 128;
    }
    else {
      lst[cnt++] = (c >> 12) | 224;
      lst[cnt++] = ((c >> 6) & 63) | 128;
      lst[cnt++] = (c & 63) | 128;
    }
  }
  return lst;
}

// バイナリ(配列)をUTF8文字列に変換.
o.binaryToUTF8 = function( n,off,len ) {
  let c;
  let ret = "";
  len += off;
  for(let i = off ; i < len ; i ++) {
    c = n[i] & 255;
    if (c < 128) {
      ret += String.fromCharCode(c);
    }
    else if ((c > 191) && (c < 224)) {
      ret += String.fromCharCode(((c & 31) << 6) |
        ((n[i+1] & 255) & 63));
      i += 1;
    }
    else {
      ret += String.fromCharCode(((c & 15) << 12) |
        (((n[i+1] & 255) & 63) << 6) |
        ((n[i+2] & 255) & 63));
      i += 2;
    }
  }
  return ret;
}

/////////////////////////////////////////////////////
// 外部定義.
/////////////////////////////////////////////////////
for(let k in o) {
  exports[k] = o[k];
}

})(global);
