var Promise = (function() {

function isThenable( ret, ref ) {
    //Do try catching since retrieving non-existent
    //properties slows down anyway
    try {
        //Retrieving the property may throw
        var then = ret.then;
        if( typeof then === "function" ) {
            //Faking a reference so that the
            //caller may read the retrieved value
            //since reading .then again might
            //return something different
            ref.ref = then;
            return true;
        }
        return false;
    }
    catch(e) {
        errorObj.e = e;
        ref.ref = errorObj;
        //This idiosyncrasy is because of how the
        //caller code is currently layed out..
        return true;
    }
}

function isObject( value ) {
    //no need to check for undefined twice
    if( value === null ) {
        return false;
    }
    return ( typeof value === "object" ||
            typeof value === "function" );
}

function isPromise( obj ) {
    if( typeof obj !== "object" ) return false;
    return obj instanceof Promise;
}

var Err = Error;
function isError( obj ) {
    if( typeof obj !== "object" ) return false;
    return obj instanceof Err;
}

var Arr = Array;
var isArray = Arr.isArray || function( obj ) {
    return obj instanceof Arr;
};


var APPLY = {};
var UNRESOLVED = {};
var noop = function(){};

/**
 * Description.
 *
 *
 */
function Promise( resolver ) {
    if( typeof resolver === "function" )
        this._resolveResolver( resolver );
    //Bitfield Layout
    //00RF NCLL LLLL LLLL LLLL LLLL LLLL LLLL
    //0 = Always 0 (must be never used)
    //R = [Reserved]
    //F = isFulfilled
    //N = isRejected
    //C = isCancellable
    //L = Length, 26 bit unsigned
    this._bitField = IS_CANCELLABLE;
    //Since most promises have exactly 1 parallel handler
    //store the first ones directly on the object
    //The rest (if needed) are stored on the object's
    //elements array (this[0], this[1]...etc)
    //which has less indirection than when using external array
    this._fulfill0 =
    this._reject0 =
    this._progress0 =
    this._promise0 =
    this._receiver0 =
        void 0;
    //reason for rejection or fulfilled value
    this._resolvedValue = UNRESOLVED;
    //Used in cancel propagation
    this._cancellationParent = null;
}

var method = Promise.prototype;

var longStackTraces = __DEBUG__;
Promise.longStackTraces = function() {
    if( async.haveItemsQueued() &&
        longStackTraces === false
    ) {
        throw new Error("Cannot enable long stack traces " +
        "after promises have been created");
    }
    longStackTraces = true;
};

method._setTrace = function _setTrace( fn ) {
    ASSERT( this._trace == null );
    if( longStackTraces ) {
        this._trace = new CapturedTrace(
            typeof fn === "function"
            ? fn
            : _setTrace
        );
    }
    return this;
};

/**
 * @return {string}
 */
method.toString = function() {
    return "[object Promise]";
};


/**
 * Convenience method for .then( null, fn, null );
 *
 * @param {Function} fn The callback to call if this promise is rejected
 * @return {Promise}
 */
method.caught = method["catch"] = function( fn ) {
    return this._then( void 0, fn, void 0, void 0, void 0, void 0 );
};

/**
 * Convenience method for .then( null, null, fn );
 *
 * @param {Function} fn The callback to call if this promise is progressed
 * @return {Promise}
 */
method.progressed = function( fn ) {
    return this._then( void 0, void 0, fn, void 0, void 0, void 0 );
};

/**
 * Convenience method for .then( fn, fn );
 *
 * @param {Function} fn The callback to call when this promise is
 * either fulfilled or rejected
 * @return {Promise}
 */
method.resolved = function( fn ) {
    return this._then( fn, fn, void 0, void 0, void 0, void 0 );
};

/**
 * Synchronously inspect the state of this promise. Returns
 * A snapshot reflecting this promise's state exactly at the time of
 * call.
 *
 * If this promise is resolved, the inspection can be used to gain
 * access to this promise's rejection reason or fulfillment value
 * synchronously.
 *
 * (TODO) Based on inspection spec
 *
 * @return {PromiseInspection}
 */
method.inspect = function() {
    return new PromiseInspection( this );
};

/**
 * Cancel this promise. The cancellation will propagate
 * to farthest ancestor promise which is still pending.
 *
 * That ancestor will then be rejected with a CancellationError
 * object as the rejection reason.
 *
 * In a promise rejection handler you may check for a cancellation
 * by seeing if the reason object has `.name === "Cancel"`.
 *
 * Promises are by default cancellable. If you want to restrict
 * the cancellability of a promise before handing it out to a
 * client, call `.uncancellable()` which returns an uncancellable
 * promise.
 *
 * (TODO) Based on cancellation spec.
 *
 * @return {Promise}
 */
method.cancel = function() {
    if( !this.isCancellable() ) return this;
    var cancelTarget = this;
    //Propagate to the last parent that is still pending
    //Resolved promises always have ._cancellationParent === null
    while( cancelTarget._cancellationParent !== null ) {
        cancelTarget = cancelTarget._cancellationParent;
    }
    //The propagated parent or original and had no parents
    if( cancelTarget === this ) {
        var err = new CancellationError();
        this._attachExtraTrace( err );
        async.invoke( this._reject, this, err );
    }
    else {
        //Have pending parents, call cancel on the oldest
        async.invoke( cancelTarget.cancel, cancelTarget, void 0 );
    }
    return this;
};

/**
 * Create an uncancellable promise based on this promise
 *
 * @return {Promise}
 */
method.uncancellable = function() {
    var ret = new Promise();
    ret._setTrace();
    ret._unsetCancellable();
    ret._assumeStateOf( this, true );
    return ret;
};

/**
 * Like .then, but cancellation of the the returned promise
 * or any of its descendant will not propagate cancellation
 * to this promise or this promise's ancestors.
 *
 * @param {=Function} didFulfill The callback to call if this promise
 *  is fulfilled.
 * @param {=Function} didReject The callback to call if this promise
 *  is rejected.
 * @param {=Function} didProgress The callback to call if this promise is
 *  notified of progress.
 * @return {Promise}
 */
method.fork = function( didFulfill, didReject, didProgress ) {
    var ret = this.then( didFulfill, didReject, didProgress );
    ret._cancellationParent = null;
    return ret;
};

/**
 * Chain this promise with a handler that will
 * call the given `propertyName` as a method on the
 * returned fulfillment value and return the result of the call.
 *
 * If more arguments are passed, those will be used as
 * respective arguments for the method call.
 *
 * Convenience method for:
 *
 * promise.then(function(value) {
 *     return value[propertyName]()
 * });
 *
 * If propertyName is a valid JS identifier and no arguments are
 * given, the call is optimized.
 *
 * @param {string} propertyName The property to call as a function.
 * @return {Promise}
 *
 */
method.call = function( propertyName ) {
    var len = arguments.length;

    if( len < 2 ) {
        return this._callFast( propertyName );
    }
    else {
        var args = new Array(len-1);
        for( var i = 1; i < len; ++i ) {
            args[ i - 1 ] = arguments[ i ];
        }
        return this._callSlow( propertyName, args );
    }

};

/**
 * Chain this promise with a handler that will
 * read given `propertyName` on the
 * return fulfillment value.
 *
 * Convenience method for:
 *
 * promise.then(function(value) {
 *     return value[propertyName]
 * });
 *
 * If propertyName is a valid JS identifier
 * the property read is optimized.
 *
 * @param {string} propertyName The property to retrieve.
 * @return {Promise}
 *
 */
method.get = function( propertyName ) {
    return this.then( getGetter( propertyName ) );
};

/**
 *
 * (TODO promises/A+ .then())
 *
 * @param {=Function} didFulfill The callback to call if this promise
 *  is fulfilled.
 * @param {=Function} didReject The callback to call if this promise
 *  is rejected.
 * @param {=Function} didProgress The callback to call if this promise is
 *  notified of progress.
 * @return {Promise}
 *
 */
method.then = function( didFulfill, didReject, didProgress ) {
    return this._then( didFulfill, didReject, didProgress,
        void 0, void 0, void 0 );
};

/**
 *
 * like .then but the callback argument is assumed to be an array and
 * applied as parameters.
 *
 * Example using then vs spread:
 *
 * Promise.all([file, db, network]).then(function( results ) {
 *     results[0] //file result
 *     results[1] //db result
 *     results[2] //network result
 * });
 *
 * Promise.all([file, db, network]).spread(function( file, db, network ) {
 *     file //file result
 *     db //db result
 *     network //network result
 * });
 *
 * @param {=Function} didFulfill The callback to call if this promise
 *  is fulfilled.
 *
 */
method.spread = function( didFulfill ) {
    return this._then( didFulfill, void 0, void 0, APPLY, void 0, void 0 );
};
/**
 * See if this promise is fulfilled.
 *
 * @return {boolean}
 */
method.isFulfilled = function() {
    return ( this._bitField & IS_FULFILLED ) > 0;
};

/**
 * See if this promise is rejected.
 *
 * @return {boolean}
 */
method.isRejected = function() {
    return ( this._bitField & IS_REJECTED ) > 0;
};

/**
 * See if this promise is pending (not rejected and not fulfilled).
 *
 * @return {boolean}
 */
method.isPending = function() {
    return !this.isResolved();
};

/**
 * See if this promise is resolved (rejected or fulfilled).
 *
 * @return {boolean}
 */
method.isResolved = function() {
    return ( this._bitField & IS_REJECTED_OR_FULFILLED ) > 0;
};

/**
 * See if this promise can be cancelled.
 *
 * @return {boolean}
 */
method.isCancellable = function() {
    return !this.isResolved() &&
        this._cancellable();
};

/**
 * Description.
 *
 *
 */
method.map = function( fn ) {
    return Promise.map( this, fn );
};

/**
 * Description.
 *
 *
 */
method.all = function() {
    return Promise.all( this );
};

/**
 * Description.
 *
 *
 */
method.any = function() {
    return Promise.any( this );
};

/**
 * Description.
 *
 *
 */
method.settle = function() {
    return Promise.settle( this );
};

/**
 * Description.
 *
 *
 */
method.some = function( count ) {
    return Promise.some( this, count );
};

/**
 * Description.
 *
 *
 */
method.reduce = function( fn, initialValue ) {
    return Promise.reduce( this, fn, initialValue );
};

/**
 * See if obj is a promise from this library. Same
 * as calling `obj instanceof Promise`.
 *
 * @param {dynamic} obj The object to check.
 * @return {boolean}
 */
Promise.is = isPromise;

/**
 * Description.
 *
 *
 */
Promise.settle = function( promises ) {
    var ret = Promise._all( promises, SettledPromiseArray );
    return ret.promise();
};

/**
 * Description.
 *
 *
 */
Promise.all = function Promise$All( promises ) {
    var ret = Promise._all( promises, PromiseArray );
    return ret.promise();
};

/**
 * Like Promise.all but instead of having to pass an array,
 * the array is generated from the passed variadic arguments.
 *
 * Promise.all([a, b, c]) <--> Promise.join(a, b, c);
 *
 * @return {Promise}
 *
 */
Promise.join = function() {
    var ret = new Array( arguments.length );
    for( var i = 0, len = ret.length; i < len; ++i ) {
        ret[i] = arguments[i];
    }
    return Promise._all( ret, PromiseArray ).promise();
};

/**
 * Description.
 *
 *
 */
Promise.any = function( promises ) {
    var ret = Promise._all( promises, AnyPromiseArray );
    return ret.promise();
};

/**
 * Description.
 *
 *
 */
Promise.some = function( promises, howMany ) {
    var ret = Promise._all( promises, SomePromiseArray );
    if( ( howMany | 0 ) !== howMany ) {
        throw new TypeError("howMany must be an integer");
    }
    var len = ret.length();
    howMany = Math.max(0, Math.min( howMany, len ) );
    ret._howMany = howMany;
    return ret.promise();
};


function mapper( fulfilleds ) {
    var fn = this;
    var shouldDefer = false;
    for( var i = 0, len = fulfilleds.length; i < len; ++i ) {
        var fulfill = fn(fulfilleds[i]);
        if( !shouldDefer && isPromise( fulfill ) ) {
            if( fulfill.isFulfilled() ) {
                fulfilleds[i] = fulfill._resolvedValue;
                continue;
            }
            else {
                shouldDefer = true;
            }
        }
        fulfilleds[i] = fulfill;
    }
    return shouldDefer ? Promise.all( fulfilleds ) : fulfilleds;
}
/**
 * Description.
 *
 *
 */
Promise.map = function ( promises, fn ) {
    if( typeof fn !== "function" )
        throw new TypeError( "fn is not a function" );
    return Promise.all( promises )._then(
        mapper,
        void 0,
        void 0,
        fn,
        void 0,
        Promise.all
    );
};

function reducer( fulfilleds, initialValue ) {
    var fn = this;
    var len = fulfilleds.length;
    var accum;
    var startIndex = 0;

    if( initialValue !== void 0 ) {
        accum = initialValue;
        startIndex = 0;
    }
    else {
        accum = len > 0 ? fulfilleds[0] : void 0;
        startIndex = 1;
    }
    for( var i = startIndex; i < len; ++i ) {
        accum = fn( accum, fulfilleds[i], i, len );
    }
    return accum;
}

function slowReduce( promises, fn, initialValue ) {
    return Promise._all( promises, PromiseArray, slowReduce )
        .promise()
        .then( function( fulfilleds ) {
            return reducer.call( fn, fulfilleds, initialValue );
        });
}


/**
 * Description.
 *
 *
 */
Promise.reduce = function( promises, fn, initialValue ) {
    if( typeof fn !== "function" )
        throw new TypeError( "fn is not a function");
    if( initialValue !== void 0 ) {
        return slowReduce( promises, fn, initialValue );
    }
    return Promise
    //Currently smuggling internal data has a limitation
    //in that no promises can be chained after it.
    //One needs to be able to chain to get at
    //the reduced results, so fast case is only possible
    //when there is no initialValue.
        .all( promises )
        ._then( reducer, void 0, void 0, fn, void 0, Promise.all );
};

/**
 * Create a promise that is already fulfilled with the given
 * value.
 *
 * Note that the promise will be in fulfilled state right away -
 * not on the next event tick.
 *
 * @param {dynamic} value The value the promise is fulfilled with.
 * @return {Promise}
 */
Promise.fulfilled = function( value ) {
    var ret = new Promise();
    ret._setTrace();
    ret._fulfill( value );
    return ret;
};

/**
 * Create a promise that is already rejected with the given
 * reason.
 *
 * Note that the promise will be in rejected state right away -
 * not on the next event tick.
 *
 * @param {dynamic} reason The reason the promise is rejected.
 * @return {Promise}
 */
Promise.rejected = function( reason ) {
    var ret = new Promise();
    ret._setTrace();
    ret._reject( reason );
    return ret;
};

/**
 * Create a pending promise and a resolver for the promise.
 *
 * @return {PromiseResolver}
 */
Promise.pending = function( caller ) {
    var promise = new Promise();
    promise._setTrace( caller );
    return new PromiseResolver( promise );
};


/**
 * Casts the object to a trusted Promise. If the
 * object is a "thenable", then the trusted promise will
 * assimilate it. Otherwise the trusted promise is immediately
 * fulfilled with obj as the fulfillment value.
 *
 * It is recommended to use just one promise library at a time,
 * so you don't have to call this method.
 *
 * Example: ($ is jQuery)
 *
 * Promise.cast($.get("http://www.google.com")).catch(function(){
 *     //will catch to same-origin policy error here..
 *     //... unless you are running this on google website
 * });
 *
 * Note that if you return an untrusted promise inside a then e.g.:
 *
 * somePromise.then(function(url) {
 *     return $.get(url);
 * });
 *
 * Then the returned untrusted promise is autocast per Promises/A+
 * specification. In any other situation, you will need to use
 * explicit casting through Promise.cast
 *
 * @param {dynamic} obj The object to cast to a trusted Promise
 * @return {Promise}
 *
 */
Promise.cast = function( obj ) {
    if( isObject( obj ) ) {
        var ref = {ref: null};
        if( isThenable( obj, ref ) ) {
            var resolver = Promise.pending();
            ref.ref.call(obj, function( a ) {
                resolver.fulfill( a );
            }, function( a ) {
                resolver.reject( a );
            });
            return resolver.promise;
        }
    }
    return Promise.fulfilled( obj );
};

/**
 * If `fn` is a function, will set that function as a callback to call
 * when an possibly unhandled rejection happens. Passing anything other
 * than a function will have the effect of removing any callback
 * and possible errors can be lost forever.
 *
 * If a promise is rejected with a Javascript Error and is not handled
 * in a timely fashion, that promise's rejection is then possibly
 * unhandled. This can happen for example due to buggy code causing
 * a runtime Javascript error.
 *
 * The rejection system implemented must swallow all errors
 * thrown. However, if some promise doesn't have, or will not have,
 * a rejection handler anywhere in its chain, then this implies that
 * the error would be silently lost.
 *
 * By default, all such errors are reported on console but you may
 * use this function to override that behavior with your own handler.
 *
 * Example:
 *
 *     Promise.onPossiblyUnhandledRejection(function( err ) {
 *         throw err;
 *     });
 *
 * The above will throw any unhandled rejection and for example
 * crash a node process.
 *
 * @param {Function|dynamic} fn The callback function. If fn is not
 * a function, no rejections will be reported as possibly unhandled.
 *
 */
Promise.onPossiblyUnhandledRejection = function( fn ) {
    if( typeof fn === "function" ) {
        CapturedTrace.possiblyUnhandledRejection = fn;
    }
    else {
        CapturedTrace.possiblyUnhandledRejection = noop;
    }
};

/**
 * Description.
 *
 *
 */
Promise.promisify = function( callback, receiver/*, callbackDescriptor*/ ) {
    return makeNodePromisified( callback, receiver );
};

method._then = function _then( didFulfill, didReject, didProgress, receiver,
    internalData, caller ) {
    ASSERT( arguments.length === 6 );
    var haveInternalData = internalData !== void 0;
    var ret = haveInternalData ? internalData : new Promise();

    if( longStackTraces && !haveInternalData ) {
        ret._traceParent = this;
        ret._setTrace( typeof caller === "function" ? caller : _then );
    }

    var callbackIndex =
        this._addCallbacks( didFulfill, didReject, didProgress, ret, receiver );

    if( this.isResolved() ) {
        async.invoke( this._resolveLast, this, callbackIndex );
    }
    else if( !haveInternalData && this.isCancellable() ) {
        ret._cancellationParent = this;
    }

    return ret;
};

method._length = function() {
    return this._bitField & LENGTH_MASK;
};

method._setLength = function( len ) {
    this._bitField = ( this._bitField & LENGTH_CLEAR_MASK ) |
        ( len & LENGTH_MASK ) ;
};

method._cancellable = function() {
    return ( this._bitField & IS_CANCELLABLE ) > 0;
};

method._setFulfilled = function() {
    this._bitField = this._bitField | IS_FULFILLED;
};

method._setRejected = function() {
    this._bitField = this._bitField | IS_REJECTED;
};

method._setCancellable = function() {
    this._bitField = this._bitField | IS_CANCELLABLE;
};

method._unsetCancellable = function() {
    this._bitField = this._bitField & ( ~IS_CANCELLABLE );
};

method._receiverAt = function( index ) {
    ASSERT( typeof index === "number" );
    ASSERT( index >= 0 );
    ASSERT( index < this._length() );
    ASSERT( index % CALLBACK_SIZE === 0 );
    if( index === 0 ) return this._receiver0;
    return this[ index + CALLBACK_RECEIVER_OFFSET - CALLBACK_SIZE ];
};

method._promiseAt = function( index ) {
    ASSERT( typeof index === "number" );
    ASSERT( index >= 0 );
    ASSERT( index < this._length() );
    ASSERT( index % CALLBACK_SIZE === 0 );
    if( index === 0 ) return this._promise0;
    return this[ index + CALLBACK_PROMISE_OFFSET - CALLBACK_SIZE ];
};

method._fulfillAt = function( index ) {
    ASSERT( typeof index === "number" );
    ASSERT( index >= 0 );
    ASSERT( index < this._length() );
    ASSERT( index % CALLBACK_SIZE === 0 );
    if( index === 0 ) return this._fulfill0;
    return this[ index + CALLBACK_FULFILL_OFFSET - CALLBACK_SIZE ];
};

method._rejectAt = function( index ) {
    ASSERT( typeof index === "number" );
    ASSERT( index >= 0 );
    ASSERT( index < this._length() );
    ASSERT( index % CALLBACK_SIZE === 0 );
    if( index === 0 ) return this._reject0;
    return this[ index + CALLBACK_REJECT_OFFSET - CALLBACK_SIZE ];
};

method._progressAt = function( index ) {
    ASSERT( typeof index === "number" );
    ASSERT( index >= 0 );
    ASSERT( index < this._length() );
    ASSERT( index % CALLBACK_SIZE === 0 );
    if( index === 0 ) return this._progress0;
    return this[ index + CALLBACK_PROGRESS_OFFSET - CALLBACK_SIZE ];
};

method._resolveResolver = function _resolveResolver( resolver ) {
    ASSERT( typeof resolver === "function" );
    this._setTrace( _resolveResolver );
    var p = new PromiseResolver( this );
    var r = tryCatch1( resolver, this, p );
    if( r === errorObj ) {
        p.reject( r.e );
    }
};

method._addCallbacks = function(
    fulfill,
    reject,
    progress,
    promise,
    receiver
) {
    fulfill = typeof fulfill === "function" ? fulfill : noop;
    reject = typeof reject === "function" ? reject : noop;
    progress = typeof progress === "function" ? progress : noop;
    var index = this._length();

    if( index === 0 ) {
        this._fulfill0 = fulfill;
        this._reject0  = reject;
        this._progress0 = progress;
        this._promise0 = promise;
        this._receiver0 = receiver;
        this._setLength( index + CALLBACK_SIZE );
        return index;
    }

    this[ index - CALLBACK_SIZE + CALLBACK_FULFILL_OFFSET ] = fulfill;
    this[ index - CALLBACK_SIZE + CALLBACK_REJECT_OFFSET ] = reject;
    this[ index - CALLBACK_SIZE + CALLBACK_PROGRESS_OFFSET ] = progress;
    this[ index - CALLBACK_SIZE + CALLBACK_PROMISE_OFFSET ] = promise;
    this[ index - CALLBACK_SIZE + CALLBACK_RECEIVER_OFFSET ] = receiver;

    this._setLength( index + CALLBACK_SIZE );
    return index;
};

method._callFast = function( propertyName ) {
    return this.then( getFunction( propertyName ) );
};

method._callSlow = function( propertyName, args ) {
    ASSERT( isArray( args ) );
    ASSERT( args.length > 0 );
    return this.then( function( obj ) {
        return obj[propertyName].apply( obj, args );
    });
};

method._resolveLast = function( index ) {
    ASSERT( typeof index === "number" );
    ASSERT( index >= 0 );
    ASSERT( index < this._length() );
    var promise = this._promiseAt( index );
    var receiver = this._receiverAt( index );
    var fn;

    if( this.isFulfilled() ) {
        fn = this._fulfillAt( index );
    }
    else if( this.isRejected() ) {
        fn = this._rejectAt( index );
    }
    else unreachable();

    var obj = this._resolvedValue;
    var ret = obj;
    if( fn !== noop ) {
        this._resolvePromise( fn, receiver, obj, promise );
    }
    else if( this.isFulfilled() ) {
        promise._fulfill( ret );
    }
    else {
        promise._reject( ret );
    }
};

method._spreadSlowCase = function spreadSlowCase( targetFn, promise, values ) {
    promise._assumeStateOf(
        Promise.all( values )._then( targetFn, void 0, void 0, APPLY, void 0,
            spreadSlowCase ),
        false
    );
};

method._resolvePromise = function(
    onFulfilledOrRejected, receiver, value, promise
) {
    if( isError( value ) ) {
        value.__handled = true;
    }

    //if promise is not instanceof Promise
    //it is internally smuggled data
    if( !isPromise( promise ) ) {
        return onFulfilledOrRejected.call( receiver, value, promise );
    }

    var x;
    //Special receiver that means we are .applying an array of arguments
    //(for .spread() at the moment)
    if( receiver === APPLY ) {
        //Array of non-promise values is fast case
        //.spread has a bit convoluted semantics otherwise
        if( isArray( value ) ) {
            //Shouldnt be many items to loop through
            //since the spread target callback will have
            //a formal parameter for each item in the array
            for( var i = 0, len = value.length; i < len; ++i ) {
                if( isPromise( value[i] ) ) {
                    this._spreadSlowCase(
                        onFulfilledOrRejected,
                        promise,
                        value
                    );
                    return;
                }
            }
            x = tryCatchApply( onFulfilledOrRejected, value );
        }
        else {
            //(TODO) Spreading a promise that eventually returns
            //an array could be a common usage
            this._spreadSlowCase( onFulfilledOrRejected, promise, value );
            return;
        }

    }
    else {
        x = tryCatch1( onFulfilledOrRejected, receiver, value );
    }

    if( x === errorObj ) {
        promise._attachExtraTrace( x.e );
        async.invoke( promise._reject, promise, x.e );
    }
    else if( x === promise ) {
        async.invoke(
            promise._reject,
            promise,
            //1. If promise and x refer to the same object,
            //reject promise with a TypeError as the reason.
            new TypeError( "Circular thenable chain" )
        );
    }
    else {
        var ref;
        if( promise._tryAssumeStateOf( x, true ) ) {
            //2. If x is a promise, adopt its state
            return;
        }
        //3. Otherwise, if x is an object or function,
                        //(TODO) isThenable is far more thorough
                        //than other libraries?
        else if( isObject( x ) && isThenable( x, ref = {ref: null} ) ) {
            //3.2 If retrieving the property x.then
            //results in a thrown exception e,
            //reject promise with e as the reason.
            if( ref.ref === errorObj ) {
                promise._attachExtraTrace( ref.ref.e );
                async.invoke( promise._reject, promise, ref.ref.e );
            }
            else {
                //3.1. Let then be x.then
                var then = ref.ref;
                //3.3 If then is a function, call it with x as this,
                //first argument resolvePromise, and
                //second argument rejectPromise
                var threw = tryCatch2(
                        then,
                        x,
                        bindDefer( promise._fulfill, promise ),
                        bindDefer( promise._reject, promise )
                );
                //3.3.4 If calling then throws an exception e,
                if( threw === errorObj ) {
                    promise._attachExtraTrace( threw.e );
                    //3.3.4.2 Otherwise, reject promise with e as the reason.
                    async.invoke( promise._reject, promise, threw.e );
                }
            }
        }
        // 3.4 If then is not a function, fulfill promise with x.
        // 4. If x is not an object or function, fulfill promise with x.
        else {
            async.invoke( promise._fulfill, promise, x );
        }
    }
};

method._assumeStateOf = function( promise, mustAsync ) {
    ASSERT( isPromise( promise ) );
    ASSERT( typeof mustAsync === "boolean" );
    if( promise.isPending() ) {
        if( promise._cancellable()  ) {
            this._cancellationParent = promise;
        }
        promise._then(
            this._fulfill,
            this._reject,
            this._progress,
            this,
            void 0,
            this._tryAssumeStateOf
        );
    }
    else if( promise.isFulfilled() ) {
        if( mustAsync )
            async.invoke( this._fulfill, this, promise._resolvedValue );
        else
            this._fulfill( promise._resolvedValue );
    }
    else {
        if( mustAsync )
            async.invoke( this._reject, this, promise._resolvedValue );
        else
            this._reject( promise._resolvedValue );
    }
};

method._tryAssumeStateOf = function  _tryAssumeStateOf( value, mustAsync ) {
    if( !isPromise( value ) ) return false;
    this._assumeStateOf( value, mustAsync );
    return true;
};

method._resolveFulfill = function( value ) {
    var len = this._length();
    for( var i = 0; i < len; i+= CALLBACK_SIZE ) {
        var fn = this._fulfillAt( i );
        var promise = this._promiseAt( i );
        var receiver = this._receiverAt( i );
        if( fn !== noop ) {
            this._resolvePromise(
                fn,
                receiver,
                value,
                promise
            );

        }
        else {
            async.invoke( promise._fulfill, promise, value );
        }
    }
};

method._resolveReject = function( reason ) {
    var len = this._length();
    var rejectionWasHandled = false;
    for( var i = 0; i < len; i+= CALLBACK_SIZE ) {
        var fn = this._rejectAt( i );
        var promise = this._promiseAt( i );
        if( fn !== noop ) {
            rejectionWasHandled = true;
            this._resolvePromise(
                fn,
                this._receiverAt( i ),
                reason,
                promise
            );
        }
        else {
            if( !rejectionWasHandled )
                rejectionWasHandled = promise._length() > 0;
            async.invoke( promise._reject, promise, reason );
        }
    }
    if( !rejectionWasHandled &&
        isError( reason ) &&
        CapturedTrace.possiblyUnhandledRejection !== noop

    ) {
        //If the prop is not there, reading it
        //will cause deoptimization most likely
        //so do it at last possible moment
        if( reason.__handled !== true ) {
            reason.__handled = false;
            async.invoke(
                this._unhandledRejection,
                this,
                reason
            );
        }
    }

};

method._attachExtraTrace = function( error ) {
    if( longStackTraces &&
        isError( error ) ) {
        var promise = this;
        var stack = error.stack.split("\n");
        var headerLineCount = 1;

        while( promise != null &&
            promise._trace != null ) {
            stack = CapturedTrace.combine(
                stack,
                promise._trace.stack.split( "\n" )
            );
            promise = promise._traceParent;
        }

        var max = Error.stackTraceLimit + headerLineCount;
        var len = stack.length;
        if( len  > max ) {
            stack.length = max;
        }
        if( stack.length <= headerLineCount ) {
            error.stack = "(No stack trace)";
        }
        else {
            error.stack = stack.join("\n");
        }
    }
};

method._notifyUnhandledRejection = function( reason ) {
    if( !reason.__handled ) {
        reason.__handled = true;
        CapturedTrace.possiblyUnhandledRejection( reason );
    }
};

method._unhandledRejection = function( reason ) {
    if( !reason.__handled ) {
        async.invokeLater( this._notifyUnhandledRejection, this, reason );
    }
};

method._cleanValues = function() {
    this._cancellationParent = null;
};

method._fulfill = function( value ) {
    if( this.isResolved() ) return;
    this._cleanValues();
    this._setFulfilled();
    this._resolvedValue = value;
    this._resolveFulfill( value );

};

method._reject = function( reason ) {
    if( this.isResolved() ) return;
    this._setRejected();
    this._resolvedValue = reason;
    this._resolveReject( reason );
    this._cleanValues();
};

method._progress = function( progressValue ) {
    //2.5 onProgress is never called once a promise
    //has already been fulfilled or rejected.

    if( this.isResolved() ) return;
    var len = this._length();
    for( var i = 0; i < len; i += CALLBACK_SIZE ) {
        var fn = this._progressAt( i );
        var promise = this._promiseAt( i );
        //if promise is not instanceof Promise
        //it is internally smuggled data
        if( !isPromise( promise ) ) {
            fn.call( this._receiverAt( i ), progressValue, promise );
            continue;
        }
        var ret = progressValue;
        if( fn !== noop ) {
            ret = tryCatch1( fn, this._receiverAt( i ), progressValue );
            if( ret === errorObj ) {
                //2.4 if the onProgress callback throws an exception
                //with a name property equal to 'StopProgressPropagation',
                //then the error is silenced.
                if( ret.e != null &&
                    ret.e.name === "StopProgressPropagation" ) {
                    ret.e.__handled = true;
                }
                else {
                    //2.3 Unless the onProgress callback throws an exception
                    //with a name property equal to 'StopProgressPropagation',
                    // the result of the function is used as the progress
                    //value to propagate.
                    promise._attachExtraTrace( ret.e );
                    async.invoke( promise._progress, promise, ret.e );
                }
            }
            //2.2 The onProgress callback may return a promise.
            else if( isPromise( ret ) ) {
                //2.2.1 The callback is not considered complete
                //until the promise is fulfilled.

                //2.2.2 The fulfillment value of the promise is the value
                //to be propagated.

                //2.2.3 If the promise is rejected, the rejection reason
                //should be treated as if it was thrown by the callback
                //directly.
                ret._then( promise._progress, null, null, promise, void 0,
                    this._progress );
            }
            else {
                async.invoke( promise._progress, promise, ret );
            }
        }
        else {
            async.invoke( promise._progress, promise, ret );
        }
    }
};

Promise._all = function _all( promises, PromiseArray, caller ) {
    ASSERT( typeof PromiseArray === "function" );
    if( isPromise( promises ) ||
        isArray( promises ) ) {

        return new PromiseArray( promises,
            typeof caller === "function"
            ? caller
            : _all
        );
    }
    throw new TypeError("expecting an array or a promise");
};


if( !CapturedTrace.isSupported() ) {
    Promise.longStackTraces = noop;
    CapturedTrace.possiblyUnhandledRejection = noop;
    Promise.onPossiblyUnhandledRejection = noop;
    longStackTraces = false;
}

return Promise;})();



