import {lcm, expand, merge} from './lib/utils'

export default class Bms2js {
  constructor(config) {
    this.bms = {
      wav: {},
      bmp: {},
      data: [],
      exbpm: {},
      stop: {},
      bgms: [],
      animations: [],
      bpms: [],
      stopTiming: []
    };
    this.wavMessages = [];
    this.config = config;
  }

  parse (bms_text) {
    let rows = bms_text.split('\n');
    for (let i = 0, len = rows.length; i < len; i++) this._parse(rows[i]);
    this._modifyAfterParse();
    this.bms.bpms[0] = {
      timing: 0,
      val: this.bms.bpm
    };
    this._serialize(this.bms.bpms, "bpm", this.bms.data);
    this._serialize(this.bms.animations, "bmp", this.bms.data);
    this._serialize(this.bms.bgms, "wav", this.bms.data);
    this._serialize(this.bms.stopTiming, "stop", this.bms.data);
    this.bms.totalNote = this._getTotalNote();
    this.bms.total = this.bms.total || 200 + this.bms.totalNote;
    this.notes = [];
    this.nodes = [];
    this.genTime = [];
    let time = 0;
    let _ref1 = this.bms.data;
    for (let i = 0, len = _ref1.length; i < len; i++) {
      let v = _ref1[i];
      let node = { timing: v.timing};
      this.appendFallParams(node, this.bms.bpms, time, 500);
      this.genTime.push(time);
      time = this.getGeneratedTime(node, 500);
      this.nodes.push(node);
    }
    for (let bar = 0, len = this.genTime.length; bar < len; bar++) {
      let time =  this.genTime[bar];
      this.generateNotes(this.bms, bar, time);
    }
    return {
      nodes: this.nodes,
      notes: this.notes,
      genTime: this.genTime,
      bgms: this.bms.bgms,
      wav: this.bms.wav,
      bpms: this.bms.bpms,
      stops: this.bms.stop,
      stopTiming: this.bms.stopTiming
    };
  };

  generateNotes (bms, measure, time) {
    var bpms, className, i, j, key, note, timing, _base, _i, _j, _len, _len1, _ref, _ref1;
    bpms = bms.bpms;
    if ((_base = this.notes)[measure] == null) {
      _base[measure] = [];
    }
    if (bms.data[measure] == null) {
      return;
    }
    _ref = bms.data[measure].note.key;
    for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
      key = _ref[i];
      _ref1 = key.timing;
      for (j = _j = 0, _len1 = _ref1.length; _j < _len1; j = ++_j) {
        timing = _ref1[j];
        className = (() => {
          switch (i) {
          case 0:
          case 2:
          case 4:
          case 6:
            return "note-white";
          case 1:
          case 3:
          case 5:
            return "note-black";
          case 7:
            return "note-turntable";
          default:
            throw new Error("error unlnown note");
          }
        })();
        note = {
          timing: timing,
          key: i,
          clear: false,
          index: 0,
          wav: key.id[j],
          className: className,
          disabled: false
        };
        this.appendFallParams(note, bpms, time, 500);
        this.notes[measure].push(note);
      }
    }
  };

  appendFallParams (obj, bpms, time, fallDist) {
    var diffDist, i, previousBpm, v, _i, _j, _k, _l, _len, _len1, _len2, _ref, _ref1, _ref2;
    previousBpm = 0;
    obj.index = 0;
    obj.distY = [];
    obj.speed = [];
    obj.bpm = {
      timing: [],
      val: []
    };
    for (i = _i = 0, _len = bpms.length; _i < _len; i = ++_i) {
      v = bpms[i];
      if (!((time < (_ref = v.timing) && _ref < obj.timing))) {
        continue;
      }
      obj.bpm.timing.push(v.timing);
      obj.bpm.val.push(v.val);
    }
    if (bpms[0].timing > time) {
      previousBpm = bpms[0].val;
    } else {
      for (_j = 0, _len1 = bpms.length; _j < _len1; _j++) {
        v = bpms[_j];
        if (v.timing <= time) {
          previousBpm = v.val;
        }
      }
    }
    obj.distY[obj.bpm.timing.length] = fallDist;
    obj.bpm.timing.push(obj.timing);
    _ref1 = obj.bpm.timing;
    for (i = _k = _ref1.length - 1; _k >= 0; i = _k += -1) {
      v = _ref1[i];
      if (!(i < obj.bpm.timing.length - 1)) {
        continue;
      }
      diffDist = (obj.bpm.timing[i + 1] - v) * this.calcSpeed(obj.bpm.val[i], fallDist, this.config.highSpeed);
      obj.distY[i] = obj.distY[i + 1] - diffDist;
    }
    obj.bpm.val.splice(0, 0, previousBpm);
    _ref2 = obj.bpm.val;
    for (_l = 0, _len2 = _ref2.length; _l < _len2; _l++) {
      v = _ref2[_l];
      obj.speed.push(this.calcSpeed(v, fallDist, this.config.highSpeed));
    }
  };

  calcSpeed (bpm, fallDistance, highSpeed = 1) {
    const barTime = 240000 / bpm;
    return fallDistance / barTime * highSpeed;
  };

  getGeneratedTime (obj, fallDist) {
    var v, _ref;
    _ref = obj.distY;
    for (let i = 0, len = _ref.length; i < len; i++) {
      v = _ref[i];
      if (v > 0) {
        return ~~(obj.bpm.timing[i] - (v / this.calcSpeed(obj.bpm.val[i], fallDist, this.config.highSpeed)));
      }
    }
    return 0;
  };

  _parse (row) {
    if (row.substring(0, 1) !== '#') return;
    const wav = /^#WAV(\w{2}) +(.*)/.exec(row);
    if (wav != null) {
      this._parseWAV(wav);
      return;
    }
    const bmp = /^#BMP(\w{2}) +(.*)/.exec(row);
    if (bmp != null) {
      this._parseBMP(bmp);
      return;
    }
    const stop = /^#STOP(\w{2}) +(.*)/.exec(row);
    if (stop != null) {
      this._parseSTOP(stop);
      return;
    }
    const extraBPM = /^#BPM(\w{2}) +(.*)/.exec(row);
    if (extraBPM != null) {
      this._parseBPM(extraBPM);
      return;
    }
    const channelMessage = /^#([0-9]{3})([0-9]{2}):([\w\.]+)/.exec(row);
    if (channelMessage != null) {
      this._parseChannelMsg(channelMessage);
      return;
    }
    const property = /^#(\w+) +(.+)/.exec(row);
    if (property != null) {
      this._parseProperty(property);
    }
  };

  _parseWAV (wav) {
    const index = parseInt(wav[1], 36);
    return this.bms.wav[index] = wav[2];
  };

  _parseBMP (bmp) {
    const index = parseInt(bmp[1], 36);
    return this.bms.bmp[index] = bmp[2];
  };

  _parseSTOP (stop) {
    const index = parseInt(stop[1], 36);
    return this.bms.stop[index] = stop[2];
  };

  _parseBPM (extraBPM) {
    const index = parseInt(extraBPM[1], 36);
    return this.bms.exbpm[index] = extraBPM[2];
  };

  _parseProperty (property) {
    return this.bms[property[1].toLowerCase()] = property[2];
  };

  _createBar () {
    var i;
    return {
      timing: 0.0,
      wav: {
        message: [],
        timing: [],
        id: []
      },
      bmp: {
        message: [],
        timing: [],
        id: []
      },
      bpm: {
        message: [],
        timing: [],
        val: []
      },
      stop: {
        message: [],
        timing: [],
        id: []
      },
      meter: 1.0,
      note: {
        key: (() => {
          var _i, _results;
          _results = [];
          for (i = _i = 0; _i <= 8; i = ++_i) {
            _results.push({
              message: [],
              timing: [],
              id: []
            });
          }
          return _results;
        })()
      }
    };
  };

  _parseChannelMsg (msg) {
    var ch, data, measureNum, meter;
    measureNum = parseInt(msg[1]);
    ch = parseInt(msg[2]);
    data = msg[3];
    if (this.bms.data[measureNum] == null) {
      this.bms.data[measureNum] = this._createBar();
    }
    switch (ch) {
    case 1:
      return this._storeWAV(data, this.bms.data[measureNum].wav, measureNum);
    case 2:
      meter = parseFloat(data);
      if (meter > 0) {
        return this.bms.data[measureNum].meter = meter;
      }
      break;
    case 3:
      return this._storeBPM(data, this.bms.data[measureNum].bpm);
    case 4:
      return this._storeData(data, this.bms.data[measureNum].bmp);
    case 8:
      return this._storeEXBPM(data, this.bms.data[measureNum].bpm);
    case 9:
      return this._storeSTOP(data, this.bms.data[measureNum].stop);
    case 11:
    case 12:
    case 13:
    case 14:
    case 15:
      return this._storeData(data, this.bms.data[measureNum].note.key[ch - 11]);
    case 16:
    case 17:
      return this._storeData(data, this.bms.data[measureNum].note.key[ch - 9]);
    case 18:
    case 19:
      return this._storeData(data, this.bms.data[measureNum].note.key[ch - 13]);
    }
  };

  _storeWAV (msg, array, measureNum) {
    var i, _base;
    if ((_base = this.wavMessages)[measureNum] == null) {
      _base[measureNum] = [];
    }
    return this.wavMessages[measureNum].push((() => {
      var _i, _ref, _results;
      _results = [];
      for (i = _i = 0, _ref = msg.length - 1; _i <= _ref; i = _i += 2) {
        _results.push(parseInt(msg.slice(i, +(i + 1) + 1 || 9e9), 36));
      }
      return _results;
    })());
  };

  _storeData (msg, array) {
    var data, i;
    data = (() => {
      var _i, _ref, _results;
      _results = [];
      for (i = _i = 0, _ref = msg.length - 1; _i <= _ref; i = _i += 2) {
        _results.push(parseInt(msg.slice(i, +(i + 1) + 1 || 9e9), 36));
      }
      return _results;
    })();
    return array.message = merge(array.message, data);
  };

  _storeSTOP (msg, array) {
    let data = (() => {
      let results = [];
      for (let i = 0, ref = msg.length - 1;  i <= ref;  i += 2) {
        results.push(parseInt(msg.slice(i, +(i + 1) + 1 || 9e9), 16));
      }
      return results;
    })();
    return array.message = merge(array.message, data);
  };

  _storeBPM (msg, bpm) {
    let results = [];
    for (let i = 0, ref = msg.length - 1; i <= ref; i += 2) {
      results.push(parseInt(msg.slice(i, +(i + 1) + 1 || 9e9), 16));
    }
    bpm.message = results;
  };

  _storeEXBPM (msg, bpm) {
    var i;
    bpm.message = (() => {
      var _i, _ref, _results;
      _results = [];
      for (i = _i = 0, _ref = msg.length - 1; _i <= _ref; i = _i += 2) {
        if (this.bms.exbpm[parseInt(msg.slice(i, +(i + 1) + 1 || 9e9), 16)] != null) {
          _results.push(parseFloat(this.bms.exbpm[parseInt(msg.slice(i, +(i + 1) + 1 || 9e9), 16)]));
        } else {
          _results.push(0);
        }
      }
      return _results;
    }).call(this);
    return console.log(bpm.message);
  }
  _modifyAfterParse () {
    var bar, bpm, i, l, time, val, _i, _len, _ref, _results;
    bpm = this.bms.bpm;
    time = 0;
    _ref = this.bms.data;
    _results = [];
    for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
      bar = _ref[i];
      if (bar == null) {
        this.bms.data[i] = this._createBar();
        this.bms.data[i].timing = time;
        time += 240000 / bpm;
        continue;
      }
      bar.timing = time;
      if (bar.bpm.message.length === 0) {
        bar.bpm.message = [0];
      }
      this._noteTiming(time, bar, bpm);
      this._bmpTiming(time, bar, bpm);
      this._stopTiming(time, bar, bpm);
      this._wavTiming(time, bar, bpm, this.wavMessages[i]);
      l = bar.bpm.message.length;
      _results.push((() => {
        var _j, _len1, _ref1, _results1;
        _ref1 = bar.bpm.message;
        _results1 = [];
        for (i = _j = 0, _len1 = _ref1.length; _j < _len1; i = ++_j) {
          val = _ref1[i];
          if (val !== 0) {
            bar.bpm.val.push(val);
            bar.bpm.timing.push(time);
            bpm = val;
          }
          _results1.push(time += (240000 / bpm) * (1 / l) * bar.meter);
        }
        return _results1;
      })());
    }
    return _results;
  };

  _calcTiming (time, objects, bpmobj, bpm, meter) {
    var b, val;
    let bl = bpmobj.message.length;
    let ol = objects.message.length;
    let bpms = expand(bpmobj.message, lcm(bl, ol));
    let objs = expand(objects.message, lcm(bl, ol));
    let t = 0;
    objects.timing = [];
    objects.id = [];
    for (let i = 0, len = bpms.length; i < len;  i++) {
      val = bpms[i];
      if (objs[i] !== 0) {
        objects.timing.push(time + t);
        objects.id.push(objs[i]);
        if (this.bms.endTime < time + t) {
          this.bms.endTime = time + t;
        }
      }
      if (val !== 0) bpm = val;
      t += (240000 / bpm) * (1 / lcm(bl, ol)) * meter;
    }
  };

  _noteTiming (time, bar, bpm) {
    for (let i = 0, len = bar.note.key.length; i < len; i++) {
      if (bar.note.key[i].message.length !== 0) {
        this._calcTiming(time, bar.note.key[i], bar.bpm, bpm, bar.meter);
      }
    }
  }

  _bmpTiming (time, bar, bpm) {
    this._calcTiming(time, bar.bmp, bar.bpm, bpm, bar.meter);
  }

  _stopTiming (time, bar, bpm) {
    this._calcTiming(time, bar.stop, bar.bpm, bpm, bar.meter);
  }

  _wavTiming (time, bar, bpm, wavss) {
    var  bpms, val, wavs,   _ref, _results;
    if (wavss == null)  return;
    let l = bar.bpm.message.length;
    let result = [];
    for (let i = 0, len = wavss.length; i < len; i++) {
      let ws = wavss[i];
      let wl = ws.length;
      bpms = expand(bar.bpm.message, lcm(l, wl));
      wavs = expand(ws, lcm(l, wl));
      let t = 0;
      let b = bpm;
      for (let i = 0, len = bpms.length; i < len; i ++) {
        val = bpms[i];
        if (wavs[i] !== 0) {
          result.push({
            timing: time + t,
            id: wavs[i]
          });
          if (this.bms.endTime < time + t) this.bms.endTime = time + t;
        }
        if (val !== 0)  b = val;
        t += (240000 / b) * (1 / lcm(l, wl)) * bar.meter;
      }
    }
    _ref = result.sort((a, b) =>  a['timing'] - b['timing']);
    let results = [];
    for (let i = 0, len = _ref.length; i < len; i++) {
      bar.wav.timing.push(_ref[i].timing);
      results.push(bar.wav.id.push(_ref[i].id));
    }
    return results;
  };

  _serialize (arr, name, bms_data) {
    var i, j, t, v, _i, _len, _results;
    _results = [];
    for (i = _i = 0, _len = bms_data.length; _i < _len; i = ++_i) {
      v = bms_data[i];
      _results.push((() => {
        var _j, _len1, _ref, _results1;
        _ref = v[name].timing;
        _results1 = [];
        for (j = _j = 0, _len1 = _ref.length; _j < _len1; j = ++_j) {
          t = _ref[j];
          if (t != null) {
            if (v[name].val != null) {
              _results1.push(arr.push({
                timing: t,
                val: v[name].val[j]
              }));
            } else if (v[name].id != null) {
              _results1.push(arr.push({
                timing: t,
                id: v[name].id[j]
              }));
            } else {
              _results1.push(void 0);
            }
          }
        }
        return _results1;
      })());
    }
    return _results;
  };

  _getTotalNote() {
    return this.bms.data.reduce(((t, d) => {
      return t + d.note.key.reduce(((nt, k) => {
        return nt + k.id.length;
      }), 0);
    }), 0);
  }
}
