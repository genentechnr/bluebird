"use strict";
module.exports = function() {
var global = require("./global.js");
var ASSERT = require("./assert.js");
var util = require("./util.js");
var async = require("./async.js");
var errors = require("./errors.js");

var INTERNAL = function(){};
var APPLY = {};
var NEXT_FILTER = {e: null};

var PromiseArray = require("./promise_array.js")(Promise);
var CapturedTrace = require("./captured_trace.js")();
var CatchFilter = require("./catch_filter.js")(NEXT_FILTER);
var PromiseResolver = require("./promise_resolver.js");

var isArray = util.isArray;
var notEnumerableProp = util.notEnumerableProp;
var isObject = util.isObject;

var ensurePropertyExpansion = util.ensurePropertyExpansion;
var errorObj = util.errorObj;
var tryCatch1 = util.tryCatch1;
var tryCatch2 = util.tryCatch2;
var tryCatchApply = util.tryCatchApply;
var TypeError = errors.TypeError;
var CancellationError = errors.CancellationError;
var TimeoutError = errors.TimeoutError;
var RejectionError = errors.RejectionError;
var ensureNotHandled = errors.ensureNotHandled;
var withHandledMarked = errors.withHandledMarked;
var withStackAttached = errors.withStackAttached;
var isStackAttached = errors.isStackAttached;
var isHandled = errors.isHandled;
var canAttach = errors.canAttach;
var thrower = util.thrower;
var apiRejection = require("./errors_api_rejection")(Promise);


var makeSelfResolutionError = function Promise$_makeSelfResolutionError() {
    return new TypeError("Circular promise resolution chain");
};

function isPromise(obj) {
    if (typeof obj !== "object") return false;
    return obj instanceof Promise;
}

function Promise(resolver) {
    if (typeof resolver !== "function") {
        throw new TypeError("You must pass a resolver function " +
            "as the sole argument to the promise constructor");
    }
    //see constants.js for layout
    this._bitField = NO_STATE;
    //Since most promises have exactly 1 parallel handler
    //store the first ones directly on the object
    //The rest (if needed) are stored on the object's
    //elements array (this[0], this[1]...etc)
    //which has less indirection than when using external array
    this._fulfillmentHandler0 = void 0;
    this._rejectionHandler0 = void 0;
    this._progressHandler0 = void 0;
    this._promise0 = void 0;
    this._receiver0 = void 0;
    //reason for rejection or fulfilled value
    this._settledValue = void 0;
    if (debugging) this._traceParent = this._peekContext();
    if (resolver !== INTERNAL) this._resolveFromResolver(resolver);
}

Promise.prototype.bind = function Promise$bind(thisArg) {
    var ret = new Promise(INTERNAL);
    ret._setTrace(this.bind, this);
    ret._follow(this, MUST_ASYNC);
    ret._setBoundTo(thisArg);
    if (this._cancellable()) {
        ret._setCancellable();
        ret._cancellationParent = this;
    }
    return ret;
};

Promise.prototype.toString = function Promise$toString() {
    return "[object Promise]";
};

Promise.prototype.caught = Promise.prototype["catch"] =
function Promise$catch(fn) {
    var len = arguments.length;
    if (len > 1) {
        var catchInstances = new Array(len - 1),
            j = 0, i;
        for (i = 0; i < len - 1; ++i) {
            var item = arguments[i];
            if (typeof item === "function") {
                catchInstances[j++] = item;
            }
            else {
                var catchFilterTypeError =
                    new TypeError(
                        "A catch filter must be an error constructor "
                        + "or a filter function");

                this._attachExtraTrace(catchFilterTypeError);
                async.invoke(this._reject, this, catchFilterTypeError);
                return;
            }
        }
        catchInstances.length = j;
        fn = arguments[i];

        this._resetTrace(this.caught);
        var catchFilter = new CatchFilter(catchInstances, fn, this);
        return this._then(void 0, catchFilter.doFilter, void 0,
            catchFilter, void 0, this.caught);
    }
    return this._then(void 0, fn, void 0, void 0, void 0, this.caught);
};

Promise.prototype.then =
function Promise$then(didFulfill, didReject, didProgress) {
    return this._then(didFulfill, didReject, didProgress,
        void 0, void 0, this.then);
};


Promise.prototype.done =
function Promise$done(didFulfill, didReject, didProgress) {
    var promise = this._then(didFulfill, didReject, didProgress,
        void 0, void 0, this.done);
    promise._setIsFinal();
};

Promise.prototype.spread = function Promise$spread(didFulfill, didReject) {
    return this._then(didFulfill, didReject, void 0,
        APPLY, void 0, this.spread);
};

Promise.prototype.isFulfilled = function Promise$isFulfilled() {
    return (this._bitField & IS_FULFILLED) > 0;
};


Promise.prototype.isRejected = function Promise$isRejected() {
    return (this._bitField & IS_REJECTED) > 0;
};

Promise.prototype.isPending = function Promise$isPending() {
    return !this.isResolved();
};


Promise.prototype.isResolved = function Promise$isResolved() {
    return (this._bitField & IS_REJECTED_OR_FULFILLED) > 0;
};


Promise.prototype.isCancellable = function Promise$isCancellable() {
    return !this.isResolved() &&
        this._cancellable();
};

Promise.prototype.toJSON = function Promise$toJSON() {
    var ret = {
        isFulfilled: false,
        isRejected: false,
        fulfillmentValue: void 0,
        rejectionReason: void 0
    };
    if (this.isFulfilled()) {
        ret.fulfillmentValue = this._settledValue;
        ret.isFulfilled = true;
    }
    else if (this.isRejected()) {
        ret.rejectionReason = this._settledValue;
        ret.isRejected = true;
    }
    return ret;
};

Promise.prototype.all = function Promise$all() {
    return Promise$_all(this, USE_BOUND, this.all);
};


Promise.is = isPromise;

function Promise$_all(promises, useBound, caller) {
    return Promise$_All(
        promises,
        PromiseArray,
        caller,
        useBound === USE_BOUND && promises._isBound()
            ? promises._boundTo
            : void 0
   ).promise();
}
Promise.all = function Promise$All(promises) {
    return Promise$_all(promises, DONT_USE_BOUND, Promise.all);
};

Promise.join = function Promise$Join() {
    INLINE_SLICE(args, arguments);
    return Promise$_All(args, PromiseArray, Promise.join, void 0).promise();
};

Promise.resolve = Promise.fulfilled =
function Promise$Resolve(value, caller) {
    var ret = new Promise(INTERNAL);
    ret._setTrace(typeof caller === "function"
        ? caller
        : Promise.resolve, void 0);
    if (ret._tryFollow(value, MAY_SYNC)) {
        return ret;
    }
    ret._cleanValues();
    ret._setFulfilled();
    ret._settledValue = value;
    return ret;
};

Promise.reject = Promise.rejected = function Promise$Reject(reason) {
    var ret = new Promise(INTERNAL);
    ret._setTrace(Promise.reject, void 0);
    ret._cleanValues();
    ret._setRejected();
    ret._settledValue = reason;
    return ret;
};

Promise.prototype._resolveFromSyncValue =
function Promise$_resolveFromSyncValue(value, caller) {
    if (value === errorObj) {
        this._cleanValues();
        this._setRejected();
        this._settledValue = value.e;
    }
    else {
        var maybePromise = Promise._cast(value, caller, void 0);
        if (maybePromise instanceof Promise) {
            this._follow(maybePromise, MUST_ASYNC);
        }
        else {
            this._cleanValues();
            this._setFulfilled();
            this._settledValue = value;
        }
    }
};

Promise.method = function Promise$_Method(fn) {
    if (typeof fn !== "function") {
        throw new TypeError("fn must be a function");
    }
    return function Promise$_method() {
        var value;
        switch(arguments.length) {
        case 0: value = tryCatch1(fn, this, void 0); break;
        case 1: value = tryCatch1(fn, this, arguments[0]); break;
        case 2: value = tryCatch2(fn, this, arguments[0], arguments[1]); break;
        default:
            INLINE_SLICE(args, arguments);
            value = tryCatchApply(fn, args, this); break;
        }
        var ret = new Promise(INTERNAL);
        ret._setTrace(Promise$_method, void 0);
        ret._resolveFromSyncValue(value, Promise$_method);
        return ret;
    };
};

Promise["try"] = Promise.attempt = function Promise$_Try(fn, args, ctx) {

    if (typeof fn !== "function") {
        return apiRejection("fn must be a function");
    }
    var value = isArray(args)
        ? tryCatchApply(fn, args, ctx)
        : tryCatch1(fn, ctx, args);

    var ret = new Promise(INTERNAL);
    ret._setTrace(Promise.attempt, void 0);
    ret._resolveFromSyncValue(value, Promise.attempt);
    return ret;
};

Promise.defer = Promise.pending = function Promise$Defer(caller) {
    var promise = new Promise(INTERNAL);
    promise._setTrace(typeof caller === "function"
                              ? caller : Promise.defer, void 0);
    return new PromiseResolver(promise);
};

Promise.bind = function Promise$Bind(thisArg) {
    var ret = new Promise(INTERNAL);
    ret._setTrace(Promise.bind, void 0);
    ret._setFulfilled();
    ret._setBoundTo(thisArg);
    return ret;
};

Promise.cast = function Promise$_Cast(obj, caller) {
    if (typeof caller !== "function") {
        caller = Promise.cast;
    }
    var ret = Promise._cast(obj, caller, void 0);
    if (!(ret instanceof Promise)) {
        return Promise.resolve(ret, caller);
    }
    return ret;
};

Promise.onPossiblyUnhandledRejection =
function Promise$OnPossiblyUnhandledRejection(fn) {
    if (typeof fn === "function") {
        CapturedTrace.possiblyUnhandledRejection = fn;
    }
    else {
        CapturedTrace.possiblyUnhandledRejection = void 0;
    }
};

var debugging = __DEBUG__ || !!(
    typeof process !== "undefined" &&
    typeof process.execPath === "string" &&
    typeof process.env === "object" &&
    (process.env["BLUEBIRD_DEBUG"] ||
        process.env["NODE_ENV"] === "development")
);


Promise.longStackTraces = function Promise$LongStackTraces() {
    if (async.haveItemsQueued() &&
        debugging === false
   ) {
        throw new Error("Cannot enable long stack traces " +
        "after promises have been created");
    }
    debugging = true;
};

Promise.hasLongStackTraces = function Promise$HasLongStackTraces() {
    return debugging && CapturedTrace.isSupported();
};

Promise.prototype._then =
function Promise$_then(
    didFulfill,
    didReject,
    didProgress,
    receiver,
    internalData,
    caller
) {
    ASSERT(arguments.length === 6);
    var haveInternalData = internalData !== void 0;
    var ret = haveInternalData ? internalData : new Promise(INTERNAL);

    if (debugging && !haveInternalData) {
        var haveSameContext = this._peekContext() === this._traceParent;
        ret._traceParent = haveSameContext ? this._traceParent : this;
        ret._setTrace(typeof caller === "function" ?
            caller : this._then, this);
    }

    if (!haveInternalData && this._isBound()) {
        ret._setBoundTo(this._boundTo);
    }

    var callbackIndex =
        this._addCallbacks(didFulfill, didReject, didProgress, ret, receiver);

    if (!haveInternalData && this._cancellable()) {
        ret._setCancellable();
        ret._cancellationParent = this;
    }

    if (this.isResolved()) {
        async.invoke(this._queueSettleAt, this, callbackIndex);
    }

    return ret;
};

Promise.prototype._length = function Promise$_length() {
    ASSERT(isPromise(this));
    ASSERT(arguments.length === 0);
    return this._bitField & LENGTH_MASK;
};

Promise.prototype._isFollowingOrFulfilledOrRejected =
function Promise$_isFollowingOrFulfilledOrRejected() {
    return (this._bitField & IS_FOLLOWING_OR_REJECTED_OR_FULFILLED) > 0;
};

Promise.prototype._isFollowing = function Promise$_isFollowing() {
    return (this._bitField & IS_FOLLOWING) === IS_FOLLOWING;
};

Promise.prototype._setLength = function Promise$_setLength(len) {
    this._bitField = (this._bitField & LENGTH_CLEAR_MASK) |
        (len & LENGTH_MASK);
};

Promise.prototype._cancellable = function Promise$_cancellable() {
    return (this._bitField & IS_CANCELLABLE) > 0;
};

Promise.prototype._setFulfilled = function Promise$_setFulfilled() {
    this._bitField = this._bitField | IS_FULFILLED;
};

Promise.prototype._setRejected = function Promise$_setRejected() {
    this._bitField = this._bitField | IS_REJECTED;
};

Promise.prototype._setFollowing = function Promise$_setFollowing() {
    this._bitField = this._bitField | IS_FOLLOWING;
};

Promise.prototype._setIsFinal = function Promise$_setIsFinal() {
    this._bitField = this._bitField | IS_FINAL;
};

Promise.prototype._isFinal = function Promise$_isFinal() {
    return (this._bitField & IS_FINAL) > 0;
};

Promise.prototype._setCancellable = function Promise$_setCancellable() {
    this._bitField = this._bitField | IS_CANCELLABLE;
};

Promise.prototype._unsetCancellable = function Promise$_unsetCancellable() {
    this._bitField = this._bitField & (~IS_CANCELLABLE);
};

Promise.prototype._receiverAt = function Promise$_receiverAt(index) {
    ASSERT(typeof index === "number");
    ASSERT(index >= 0);
    ASSERT(index % CALLBACK_SIZE === 0);

    var ret;
    if (index === 0) {
        ret = this._receiver0;
    }
    else {
        ret = this[index + CALLBACK_RECEIVER_OFFSET - CALLBACK_SIZE];
    }
    //Only use the bound value when not calling internal methods
    if (this._isBound() && ret === void 0) {
        return this._boundTo;
    }
    return ret;
};

Promise.prototype._promiseAt = function Promise$_promiseAt(index) {
    ASSERT(typeof index === "number");
    ASSERT(index >= 0);
    ASSERT(index % CALLBACK_SIZE === 0);
    if (index === 0) return this._promise0;
    return this[index + CALLBACK_PROMISE_OFFSET - CALLBACK_SIZE];
};

Promise.prototype._fulfillmentHandlerAt =
function Promise$_fulfillmentHandlerAt(index) {
    ASSERT(typeof index === "number");
    ASSERT(index >= 0);
    ASSERT(index % CALLBACK_SIZE === 0);
    if (index === 0) return this._fulfillmentHandler0;
    return this[index + CALLBACK_FULFILL_OFFSET - CALLBACK_SIZE];
};

Promise.prototype._rejectionHandlerAt =
function Promise$_rejectionHandlerAt(index) {
    ASSERT(typeof index === "number");
    ASSERT(index >= 0);
    ASSERT(index % CALLBACK_SIZE === 0);
    if (index === 0) return this._rejectionHandler0;
    return this[index + CALLBACK_REJECT_OFFSET - CALLBACK_SIZE];
};

Promise.prototype._unsetAt = function Promise$_unsetAt(index) {
    ASSERT(typeof index === "number");
    ASSERT(index >= 0);
    ASSERT(index % CALLBACK_SIZE === 0);
     if (index === 0) {
        this._fulfillmentHandler0 =
        this._rejectionHandler0 =
        this._progressHandler0 =
        this._promise0 =
        this._receiver0 = void 0;
    }
    else {
        this[index - CALLBACK_SIZE + CALLBACK_FULFILL_OFFSET] =
        this[index - CALLBACK_SIZE + CALLBACK_REJECT_OFFSET] =
        this[index - CALLBACK_SIZE + CALLBACK_PROGRESS_OFFSET] =
        this[index - CALLBACK_SIZE + CALLBACK_PROMISE_OFFSET] =
        this[index - CALLBACK_SIZE + CALLBACK_RECEIVER_OFFSET] = void 0;
    }
};

Promise.prototype._resolveFromResolver =
function Promise$_resolveFromResolver(resolver) {
    ASSERT(typeof resolver === "function");
    this._setTrace(this._resolveFromResolver, void 0);
    var p = new PromiseResolver(this);
    this._pushContext();
    var r = tryCatch2(resolver, this, function Promise$_fulfiller(val) {
        p.fulfill(val);
    }, function Promise$_rejecter(val) {
        p.reject(val);
    });
    this._popContext();
    if (r === errorObj) {
        p.reject(r.e);
    }
};

Promise.prototype._addCallbacks = function Promise$_addCallbacks(
    fulfill,
    reject,
    progress,
    promise,
    receiver
) {
    fulfill = typeof fulfill === "function" ? fulfill : void 0;
    reject = typeof reject === "function" ? reject : void 0;
    progress = typeof progress === "function" ? progress : void 0;
    var index = this._length();

    if (index >= MAX_LENGTH - CALLBACK_SIZE) {
        index = 0;
        this._setLength(0);
    }

    if (index === 0) {
        this._promise0 = promise;
        this._receiver0 = receiver;
        this._fulfillmentHandler0 = fulfill;
        this._rejectionHandler0  = reject;
        this._progressHandler0 = progress;
        this._setLength(index + CALLBACK_SIZE);
        return index;
    }

    this[index - CALLBACK_SIZE + CALLBACK_FULFILL_OFFSET] = fulfill;
    this[index - CALLBACK_SIZE + CALLBACK_REJECT_OFFSET] = reject;
    this[index - CALLBACK_SIZE + CALLBACK_PROGRESS_OFFSET] = progress;
    this[index - CALLBACK_SIZE + CALLBACK_PROMISE_OFFSET] = promise;
    this[index - CALLBACK_SIZE + CALLBACK_RECEIVER_OFFSET] = receiver;
    this._setLength(index + CALLBACK_SIZE);
    return index;
};

Promise.prototype._spreadSlowCase =
function Promise$_spreadSlowCase(targetFn, promise, values, boundTo) {
    ASSERT(isArray(values) || isPromise(values));
    ASSERT(typeof targetFn === "function");
    ASSERT(isPromise(promise));
    promise._follow(
            Promise$_All(values, PromiseArray, this._spreadSlowCase, boundTo)
            .promise()
            ._then(function() {
                return targetFn.apply(boundTo, arguments);
            }, void 0, void 0, APPLY, void 0,
                    this._spreadSlowCase),
        MAY_SYNC
   );
};

Promise.prototype._setBoundTo = function Promise$_setBoundTo(obj) {
    if (obj !== void 0) {
        this._bitField = this._bitField | IS_BOUND;
        this._boundTo = obj;
    }
    else {
        this._bitField = this._bitField & (~IS_BOUND);
    }
};

Promise.prototype._isBound = function Promise$_isBound() {
    return (this._bitField & IS_BOUND) === IS_BOUND;
};

Promise.prototype._settlePromiseFromHandler =
function Promise$_settlePromiseFromHandler(
    handler, receiver, value, promise
) {

    //if promise is not instanceof Promise
    //it is internally smuggled data
    if (!isPromise(promise)) {
        handler.call(receiver, value, promise);
        return;
    }

    var isRejected = this.isRejected();

    if (isRejected &&
        typeof value === "object" &&
        value !== null) {
        var handledState = value[ERROR_HANDLED_KEY];

        if (handledState === void 0) {
            notEnumerableProp(value, ERROR_HANDLED_KEY, ERROR_HANDLED);
        }
        else {
            value[ERROR_HANDLED_KEY] =
                withHandledMarked(handledState);
        }
    }

    var x;
    //Special receiver that means we are .applying an array of arguments
    //(for .spread() at the moment)
    if (!isRejected && receiver === APPLY) {
        //Array of non-promise values is fast case
        //.spread has a bit convoluted semantics otherwise
        var boundTo = this._isBound() ? this._boundTo : void 0;
        if (isArray(value)) {
            //Shouldnt be many items to loop through
            //since the spread target callback will have
            //a formal parameter for each item in the array
            var caller = this._settlePromiseFromHandler;

            for (var i = 0, len = value.length; i < len; ++i) {
                if (isPromise(Promise._cast(value[i], caller, void 0))) {
                    this._spreadSlowCase(
                        handler,
                        promise,
                        value,
                        boundTo
                   );
                    return;
                }
            }
            promise._pushContext();
            x = tryCatchApply(handler, value, boundTo);
        }
        else {
            console.log(value);
            //(TODO) Spreading a promise that eventually returns
            //an array could be a common usage
            this._spreadSlowCase(handler, promise, value, boundTo);
            return;
        }
    }
    else {
        promise._pushContext();
        x = tryCatch1(handler, receiver, value);
    }

    promise._popContext();

    //Special value returned from .finally and CatchFilter#doFilter
    //to minimize exception throwing and catching
    if (x === NEXT_FILTER) {
        ASSERT(isRejected);
        //async.invoke is not needed
        promise._reject(x.e);
    }
    else if (x === errorObj) {
        ensureNotHandled(x.e);
        promise._attachExtraTrace(x.e);
        async.invoke(promise._reject, promise, x.e);
    }
    else if (x === promise) {
        var err = makeSelfResolutionError();
        this._attachExtraTrace(err);
        async.invoke(
            promise._reject,
            promise,
            //1. If promise and x refer to the same object,
            //reject promise with a TypeError as the reason.
            err
       );
    }
    else {
        var castValue = Promise._cast(x, this._settlePromiseFromHandler,
                                        promise);
        var isThenable = castValue !== x;

        if (isThenable || isPromise(castValue)) {
            promise._tryFollow(castValue, MUST_ASYNC);
            if(castValue._cancellable()) {
                promise._cancellationParent = castValue;
                promise._setCancellable();
            }
        }
        else {
            async.invoke(promise._fulfill, promise, x);
        }
    }
};

Promise.prototype._follow =
function Promise$_follow(promise, mustAsync) {
    ASSERT(isPromise(promise));
    ASSERT(mustAsync === MUST_ASYNC || mustAsync === MAY_SYNC);
    ASSERT(this._isFollowingOrFulfilledOrRejected() === false);
    ASSERT(promise !== this);
    this._setFollowing();

    if (promise.isPending()) {
        if (promise._cancellable() ) {
            this._cancellationParent = promise;
            this._setCancellable();
        }
        promise._then(
            this._fulfillUnchecked,
            this._rejectUnchecked,
            this._progressUnchecked,
            this,
            null,
            this._follow
       );
    }
    else if (promise.isFulfilled()) {
        if (mustAsync === MUST_ASYNC)
            async.invoke(this._fulfillUnchecked, this, promise._settledValue);
        else
            this._fulfillUnchecked(promise._settledValue);
    }
    else {
        if (mustAsync === MUST_ASYNC)
            async.invoke(this._rejectUnchecked, this, promise._settledValue);
        else
            this._rejectUnchecked(promise._settledValue);
    }

    if (debugging &&
        promise._traceParent == null) {
        promise._traceParent = this;
    }
};

Promise.prototype._tryFollow =
function Promise$_tryFollow(value, mustAsync) {
    if (this._isFollowingOrFulfilledOrRejected() ||
        value === this) {
        return false;
    }
    var maybePromise = Promise._cast(value, this._tryFollow, void 0);
    if (!isPromise(maybePromise)) {
        return false;
    }
    this._follow(maybePromise, mustAsync);
    return true;
};

Promise.prototype._resetTrace = function Promise$_resetTrace(caller) {
    if (debugging) {
        var context = this._peekContext();
        var isTopLevel = context === void 0;
        this._trace = new CapturedTrace(
            typeof caller === "function"
            ? caller
            : this._resetTrace,
            isTopLevel
       );
    }
};

Promise.prototype._setTrace = function Promise$_setTrace(caller, parent) {
    ASSERT(this._trace == null);
    if (debugging) {
        var context = this._peekContext();
        var isTopLevel = context === void 0;
        if (parent !== void 0 &&
            parent._traceParent === context) {
            ASSERT(parent._trace != null);
            this._trace = parent._trace;
        }
        else {
            this._trace = new CapturedTrace(
                typeof caller === "function"
                ? caller
                : this._setTrace,
                isTopLevel
           );
        }
    }
    return this;
};

Promise.prototype._attachExtraTrace =
function Promise$_attachExtraTrace(error) {
    if (debugging &&
        canAttach(error)) {
        var promise = this;
        var stack = error.stack;
        stack = typeof stack === "string"
            ? stack.split("\n") : [];
        var headerLineCount = 1;

        while(promise != null &&
            promise._trace != null) {
            stack = CapturedTrace.combine(
                stack,
                promise._trace.stack.split("\n")
           );
            promise = promise._traceParent;
        }

        var max = Error.stackTraceLimit + headerLineCount;
        var len = stack.length;
        if (len  > max) {
            stack.length = max;
        }
        if (stack.length <= headerLineCount) {
            error.stack = "(No stack trace)";
        }
        else {
            error.stack = stack.join("\n");
        }
        error[ERROR_HANDLED_KEY] =
            withStackAttached(error[ERROR_HANDLED_KEY]);
    }
};

Promise.prototype._notifyUnhandledRejection =
function Promise$_notifyUnhandledRejection(reason) {
    if (!isHandled(reason[ERROR_HANDLED_KEY])) {
        reason[ERROR_HANDLED_KEY] =
            withHandledMarked(reason[ERROR_HANDLED_KEY]);
        CapturedTrace.possiblyUnhandledRejection(reason, this);
    }
};

Promise.prototype._unhandledRejection =
function Promise$_unhandledRejection(reason) {
    if (!isHandled(reason[ERROR_HANDLED_KEY])) {
        async.invokeLater(this._notifyUnhandledRejection, this, reason);
    }
};

Promise.prototype._cleanValues = function Promise$_cleanValues() {
    if (this._cancellable()) {
        this._cancellationParent = void 0;
    }
};

Promise.prototype._fulfill = function Promise$_fulfill(value) {
    if (this._isFollowingOrFulfilledOrRejected()) return;
    this._fulfillUnchecked(value);

};

Promise.prototype._reject = function Promise$_reject(reason) {
    if (this._isFollowingOrFulfilledOrRejected()) return;
    this._rejectUnchecked(reason);
};

Promise.prototype._settlePromiseAt = function Promise$_settlePromiseAt(index) {
    var handler = this.isFulfilled()
        ? this._fulfillmentHandlerAt(index)
        : this._rejectionHandlerAt(index);

    ASSERT(this.isFulfilled() || this.isRejected());

    var value = this._settledValue;
    var receiver = this._receiverAt(index);
    var promise = this._promiseAt(index);

    if (typeof handler === "function") {
        this._settlePromiseFromHandler(handler, receiver, value, promise);
    }
    else if (this.isFulfilled()) {
        promise._fulfill(value);
    }
    else {
        promise._reject(value);
    }

    //this is only necessary against index inflation with long lived promises
    //that accumulate the index size over time,
    //not because the data wouldn't be GCd otherwise
    if (index >= 256) {
        this._queueGC();
    }
};

Promise.prototype._isGcQueued = function Promise$_isGcQueued() {
    return (this._bitField & IS_GC_QUEUED) === IS_GC_QUEUED;
};

Promise.prototype._setGcQueued = function Promise$_setGcQueued() {
    this._bitField = this._bitField | IS_GC_QUEUED;
};

Promise.prototype._unsetGcQueued = function Promise$_unsetGcQueued() {
    this._bitField = this._bitField & (~IS_GC_QUEUED);
};

Promise.prototype._queueGC = function Promise$_queueGC() {
    if (this._isGcQueued()) return;
    this._setGcQueued();
    async.invokeLater(this._gc, this, void 0);
};

Promise.prototype._gc = function Promise$gc() {
    var len = this._length();
    this._unsetAt(0);
    for (var i = 0; i < len; i++) {
        //Delete is cool on array indexes
        delete this[i];
    }
    this._setLength(0);
    this._unsetGcQueued();
};

Promise.prototype._queueSettleAt = function Promise$_queueSettleAt(index) {
    ASSERT(typeof index === "number");
    ASSERT(index >= 0);
    ASSERT(this.isFulfilled() || this.isRejected());
    async.invoke(this._settlePromiseAt, this, index);
};

Promise.prototype._fulfillUnchecked =
function Promise$_fulfillUnchecked(value) {
    ASSERT(this.isPending());
    if (value === this) {
        var err = makeSelfResolutionError();
        this._attachExtraTrace(err);
        return this._rejectUnchecked(err);
    }
    this._cleanValues();
    this._setFulfilled();
    this._settledValue = value;
    var len = this._length();

    if (len > 0) {
        async.invoke(this._fulfillPromises, this, len);
    }

};

Promise.prototype._fulfillPromises = function Promise$_fulfillPromises(len) {
    ASSERT(this.isFulfilled());
    ASSERT(len === this._length());
    ASSERT(len > 0);
    for (var i = 0; i < len; i+= CALLBACK_SIZE) {
        this._settlePromiseAt(i);
    }
};

Promise.prototype._rejectUnchecked =
function Promise$_rejectUnchecked(reason) {
    ASSERT(this.isPending());
    if (reason === this) {
        var err = makeSelfResolutionError();
        this._attachExtraTrace(err);
        return this._rejectUnchecked(err);
    }
    this._cleanValues();
    this._setRejected();
    this._settledValue = reason;
    if (this._isFinal()) {
        ASSERT(this._length() === 0);
        async.invokeLater(thrower, void 0, reason);
        return;
    }
    var len = this._length();
    if (len > 0) {
        async.invoke(this._rejectPromises, this, len);
    }
    else {
        this._ensurePossibleRejectionHandled(reason);
    }
};

Promise.prototype._rejectPromises = function Promise$_rejectPromises(len) {
    ASSERT(this.isRejected());
    ASSERT(len === this._length());
    ASSERT(len > 0);

    var rejectionWasHandled = false;
    for (var i = 0; i < len; i+= CALLBACK_SIZE) {
        var handler = this._rejectionHandlerAt(i);
        if (!rejectionWasHandled) {
            rejectionWasHandled = typeof handler === "function" ||
                                this._promiseAt(i)._length() > 0;
        }
        this._settlePromiseAt(i);
    }

    if (!rejectionWasHandled) {
        this._ensurePossibleRejectionHandled(this._settledValue);
    }
};

Promise.prototype._ensurePossibleRejectionHandled =
function Promise$_ensurePossibleRejectionHandled(reason) {
    if (CapturedTrace.possiblyUnhandledRejection !== void 0) {
        if (isObject(reason)) {
            var handledState = reason[ERROR_HANDLED_KEY];
            var newReason = reason;

            if (handledState === void 0) {
                newReason = ensurePropertyExpansion(reason,
                    ERROR_HANDLED_KEY, DEFAULT_STATE);
                handledState = DEFAULT_STATE;
            }
            else if (isHandled(handledState)) {
                return;
            }

            if (!isStackAttached(handledState))  {
                this._attachExtraTrace(newReason);
            }
            async.invoke(this._unhandledRejection, this, newReason);
        }
    }
};

var contextStack = [];
Promise.prototype._peekContext = function Promise$_peekContext() {
    var lastIndex = contextStack.length - 1;
    if (lastIndex >= 0) {
        return contextStack[lastIndex];
    }
    return void 0;

};

Promise.prototype._pushContext = function Promise$_pushContext() {
    if (!debugging) return;
    contextStack.push(this);
};

Promise.prototype._popContext = function Promise$_popContext() {
    if (!debugging) return;
    contextStack.pop();
};

function Promise$_All(promises, PromiseArray, caller, boundTo) {

    ASSERT(arguments.length === 4);
    ASSERT(typeof PromiseArray === "function");

    var list = null;
    if (isArray(promises)) {
        list = promises;
    }
    /*else if (isIterable...)*/
    else {
        list = Promise._cast(promises, caller, void 0);
        if (list !== promises) {
            list._setBoundTo(boundTo);
        }
        else if (!isPromise(list)) {
            list = null;
        }
    }
    if (list !== null) {
        return new PromiseArray(
            list,
            typeof caller === "function"
                ? caller
                : Promise$_All,
            boundTo
       );
    }
    return {
        promise: function() {return apiRejection(COLLECTION_ERROR);}
    };
}

var old = global.Promise;

Promise.noConflict = function() {
    if (global.Promise === Promise) {
        global.Promise = old;
    }
    return Promise;
};

if (!CapturedTrace.isSupported()) {
    Promise.debugging = function(){};
    debugging = false;
}

Promise._makeSelfResolutionError = makeSelfResolutionError;
require("./finally.js")(Promise, NEXT_FILTER);
require("./direct_resolve.js")(Promise);
require("./thenables.js")(Promise);
Promise.CancellationError = CancellationError;
Promise.TimeoutError = TimeoutError;
Promise.TypeError = TypeError;
Promise.RejectionError = RejectionError;
};
