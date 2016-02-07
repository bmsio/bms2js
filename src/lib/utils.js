export function lcm(a, b) {
  const gcm = (x, y) => {
    if (y === 0) return x;
    else return gcm(y, x % y);
  };
  return a * b / gcm(a, b);
}

// ex. expand([1,2,3],6) == [1,0,2,0,3,0]
export function expand(array, length) {
  let results = [];
  if (array.length === 0) {
    for (let i = 0, len = length; i < len; i++) {
      results.push(0);
    }
    return results;
  }
  let interval = length / array.length;
  for (let i = 0, len = length; i < len; i++) {
    results.push(i % interval === 0 ? array[i / interval] : 0);
  }
  return results;
}

export function merge(ary1, ary2) {
  if (ary1.length === 0) {
    return ary2;
  }
  const _lcm = lcm(ary1.length, ary2.length);
  let ret = this._expand(ary1, _lcm);
  let ref = this._expand(ary2, _lcm);
  for (let i = 0, len = ref.length; i < len; i = i++) {
    value = ref[i];
    if (value === 0) {
      continue;
    }
    ret[i] = value;
  }
  return ret;
}

