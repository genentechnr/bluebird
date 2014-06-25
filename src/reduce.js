"use strict";
module.exports = function(Promise, PromiseArray, apiRejection, cast, INTERNAL) {
var util = require("./util.js");
var tryCatch4 = util.tryCatch4;
var tryCatch3 = util.tryCatch3;
var errorObj = util.errorObj;
var PENDING = {};
function ReductionPromiseArray(promises, fn, accum, _each) {
    this.constructor$(promises);
    this._preservedValues = _each === INTERNAL ? [] : null;
    // `false` = initialValue provided as `accum` argument
    // `true` = treat the 0th value as initialValue
    this._zerothIsAccum = (accum === void 0);
    // `true` = we've received our initialValue
    this._gotAccum = false;
    // phase 1 = we've received its initial value
    // phase 2 = we've received its reduced value
    this._valuesPhase = [];
    // index of the value we are in the process of reducing
    this._reducingIndex = (this._zerothIsAccum ? 1 : 0);

    var maybePromise = cast(accum, void 0);
    var rejected = false;
    var isPromise = maybePromise instanceof Promise;
    if (isPromise) {
        if (maybePromise.isPending()) {
            maybePromise._proxyPromiseArray(this, -1);
        } else if (maybePromise.isFulfilled()) {
            accum = maybePromise.value();
            this._gotAccum = true;
        } else {
            maybePromise._unsetRejectionIsUnhandled();
            this._reject(maybePromise.reason());
            rejected = true;
        }
    }
    if (! (isPromise || this._zerothIsAccum)) this._gotAccum = true;
    this._callback = fn;
    this._accum = accum;
    if (!rejected) this._init$(void 0, RESOLVE_CALL_METHOD);
}
util.inherits(ReductionPromiseArray, PromiseArray);

// Override
ReductionPromiseArray.prototype._init =
function ReductionPromiseArray$_init() {};

// Override
ReductionPromiseArray.prototype._resolveEmptyArray =
function ReductionPromiseArray$_resolveEmptyArray() {
    // we may resolve
    // once we've received our initialValue,
    // or if it's the 0th value (and we don't need to wait)
    if (this._gotAccum || this._zerothIsAccum) {
        this._resolve(this._preservedValues !== null
                        ? [] : this._accum);
    }
};

// Override
ReductionPromiseArray.prototype._promiseFulfilled =
function ReductionPromiseArray$_promiseFulfilled(value, index) {
    // not really fulfilled
    if (value === PENDING) return;
    var values = this._values;
    if (values === null) return;
    var length = this.length();
    var preservedValues = this._preservedValues;
    var isEach = preservedValues !== null;
    var gotAccum = this._gotAccum;
    var valuesPhase = this._valuesPhase;

    // Special case detection where the processing starts at index 1
    // because no initialValue was given
    if (index === 0 && this._zerothIsAccum) {
        if (! gotAccum) {
            this._accum = value;
            this._gotAccum = gotAccum = true;
        }
        values[index] = value;
        valuesPhase[index] = (valuesPhase[index] || 0) + 1;
    // the initialValue was a promise and was fulfilled
    } else if (index === -1) {
        if (! gotAccum) {
            this._accum = value;
            this._gotAccum = gotAccum = true;
        }
    } else {
        values[index] = value;
        valuesPhase[index] = (valuesPhase[index] || 0) + 1;
        if (gotAccum && (valuesPhase[index] > 1)) {
            this._accum = value;
        }
    }
    // no point in reducing anything until we have an initialValue
    if (! gotAccum) return;

    var callback = this._callback;
    var receiver = this._promise._boundTo;
    var ret;

    for (var i = this._reducingIndex; i < length; ++i) {
        var phase = valuesPhase[i];
        if (! phase) return;
        if (phase > 1) {
            // it has already been reduced
            this._reducingIndex = i + 1;
            continue;
        }

        value = values[i];
        if (value === PENDING) return;
        if (value instanceof Promise) {
            if (value.isFulfilled()) {
                value = value._settledValue;
            } else if (value.isPending()) {
                // Continue later when the promise at current index fulfills
                return;
            } else {
                value._unsetRejectionIsUnhandled();
                return this._reject(value.reason());
            }
        }

        if (isEach) {
            preservedValues.push(value);
            ret = tryCatch3(callback, receiver, value, i, length);
        }
        else {
            ret = tryCatch4(callback, receiver, this._accum, value, i, length);
        }

        if (ret === errorObj) return this._reject(ret.e);

        var maybePromise = cast(ret, void 0);
        if (maybePromise instanceof Promise) {
            // Callback returned a pending
            // promise so continue iteration when it fulfills
            if (maybePromise.isPending()) {
                // Phase 2 marker
                values[i] = PENDING;
                return maybePromise._proxyPromiseArray(this, i);
            } else if (maybePromise.isFulfilled()) {
                ret = maybePromise.value();
            } else {
                maybePromise._unsetRejectionIsUnhandled();
                return this._reject(maybePromise.reason());
            }
        }

        this._reducingIndex = i + 1;
        this._accum = ret;
    }

    // end-game, once everything has been resolved
    if (this._reducingIndex < length) return;
    this._resolve(isEach ? preservedValues : this._accum);
};

function reduce(promises, fn, initialValue, _each) {
    if (typeof fn !== "function") return apiRejection(NOT_FUNCTION_ERROR);
    var array = new ReductionPromiseArray(promises, fn, initialValue, _each);
    return array.promise();
}

Promise.prototype.reduce = function Promise$reduce(fn, initialValue) {
    return reduce(this, fn, initialValue, null);
};

Promise.reduce = function Promise$Reduce(promises, fn, initialValue, _each) {
    return reduce(promises, fn, initialValue, _each);
};
};
