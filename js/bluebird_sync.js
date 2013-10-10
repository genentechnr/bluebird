/* jshint -W014, -W116, -W106 */
/* global process */
/**
 * @preserve Copyright (c) 2013 Petka Antonov
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
(function( global, Function, Array, Error, Object ) { "use strict";

var haveGetters = (function(){
    try {
        var o = {};
        Object.defineProperty(o, "f", {
            get: function () {
                return 3;
            }
        });
        return o.f === 3;
    }
    catch(e) {
        return false;
    }

})();

var errorObj = {e: {}};
var rescape = /[\r\n\u2028\u2029']/g;

var replacer = function( ch ) {
        return "\\u" + (("0000") +
            (ch.charCodeAt(0).toString(16))).slice(-4);
};

function safeToEmbedString( str ) {
    return str.replace( rescape, replacer );
}

function deprecated( msg ) {
    if( typeof console !== "undefined" && console !== null &&
        typeof console.warn === "function" ) {
        console.warn( "Bluebird: " + msg );
    }
}

function tryCatch1( fn, receiver, arg ) {
    try {
        return fn.call( receiver, arg );
    }
    catch( e ) {
        errorObj.e = e;
        return errorObj;
    }
}

function tryCatch2( fn, receiver, arg, arg2 ) {
    try {
        return fn.call( receiver, arg, arg2 );
    }
    catch( e ) {
        errorObj.e = e;
        return errorObj;
    }
}

function tryCatchApply( fn, args ) {
    try {
        return fn.apply( void 0, args );
    }
    catch( e ) {
        errorObj.e = e;
        return errorObj;
    }
}

var create = Object.create || function( proto ) {
    function F(){}
    F.prototype = proto;
    return new F();
};

var inherits = function( Child, Parent ) {
    var hasProp = {}.hasOwnProperty;

    function T() {
        this.constructor = Child;
        this.constructor$ = Parent;
        for (var propertyName in Parent.prototype) {
            if (hasProp.call( Parent.prototype, propertyName) &&
                propertyName.charAt(propertyName.length-1) !== "$"
            ) {
                this[ propertyName + "$"] = Parent.prototype[propertyName];
            }
        }
    }
    T.prototype = Parent.prototype;
    Child.prototype = new T();
    return Child.prototype;
};

function asString( val ) {
    return typeof val === "string" ? val : ( "" + val );
}

function isPrimitive( val ) {
    return val == null || val === true || val === false ||
        typeof val === "string" || typeof val === "number";

}

function maybeWrapAsError( maybeError ) {
    if( !isPrimitive( maybeError ) ) return maybeError;

    return new Error( asString( maybeError ) );
}

function nodebackForResolver( resolver ) {
    function PromiseResolver$_callback( err, value ) {
        if( err ) {
            resolver.reject( maybeWrapAsError( err ) );
        }
        else {
            if( arguments.length > 2 ) {
                var len = arguments.length;
                var val = new Array( len - 1 );
                for( var i = 1; i < len; ++i ) {
                    val[ i - 1 ] = arguments[ i ];
                }

                value = val;
            }
            resolver.fulfill( value );
        }
    }
    return PromiseResolver$_callback;
}

function withAppended( target, appendee ) {
    var len = target.length;
    var ret = new Array( len + 1 );
    var i;
    for( i = 0; i < len; ++i ) {
        ret[ i ] = target[ i ];
    }
    ret[ i ] = appendee;
    return ret;
}


function notEnumerableProp( obj, name, value ) {
    var descriptor = {
        value: value,
        configurable: true,
        enumerable: false,
        writable: true
    };
    Object.defineProperty( obj, name, descriptor );
    return obj;
}

var THIS = {};
function makeNodePromisified( callback, receiver, originalName ) {

    function getCall(count) {
        var args = new Array(count);
        for( var i = 0, len = args.length; i < len; ++i ) {
            args[i] = "a" + (i+1);
        }
        var comma = count > 0 ? "," : "";

        if( typeof callback === "string" &&
            receiver === THIS ) {
            return "this['" + callback + "']("+args.join(",")+ comma +" fn);"+
                "break;";
        }
        return ( receiver === void 0
            ? "callback("+args.join(",")+ comma +" fn);"
            : "callback.call("+( receiver === THIS
                ? "this"
                : "receiver" )+", "+args.join(",") + comma + " fn);" ) +
        "break;";
    }

    var callbackName = ( typeof originalName === "string" ?
        originalName + "Async" :
        "promisified" );

    return new Function("Promise", "callback", "receiver",
            "withAppended", "maybeWrapAsError", "nodebackForResolver",
        "var ret = function " + callbackName +
        "( a1, a2, a3, a4, a5 ) {\"use strict\";" +
        "var len = arguments.length;" +
        "var resolver = Promise.pending( " + callbackName + " );" +
        "var fn = nodebackForResolver( resolver );"+
        "try{" +
        "switch( len ) {" +
        "case 1:" + getCall(1) +
        "case 2:" + getCall(2) +
        "case 3:" + getCall(3) +
        "case 0:" + getCall(0) +
        "case 4:" + getCall(4) +
        "case 5:" + getCall(5) +
        "default: " + (typeof callback === "string"
            ? "this['" + callback + "'].apply("
            : "callback.apply("
        ) +
            ( receiver === THIS ? "this" : "receiver" ) +
        ", withAppended( arguments, fn ) ); break;" +
        "}" +
        "}" +
        "catch(e){ " +
        "" +
        "resolver.reject( maybeWrapAsError( e ) );" +
        "}" +
        "return resolver.promise;" +
        "" +
        "}; ret.__isPromisified__ = true; return ret;"
    )(Promise, callback, receiver, withAppended,
        maybeWrapAsError, nodebackForResolver);
}
var Deque = (function() {
function arrayCopy( src, srcIndex, dst, dstIndex, len ) {
    for( var j = 0; j < len; ++j ) {
        dst[ j + dstIndex ] = src[ j + srcIndex ];
    }
}

function pow2AtLeast( n ) {
    n = n >>> 0;
    n = n - 1;
    n = n | (n >> 1);
    n = n | (n >> 2);
    n = n | (n >> 4);
    n = n | (n >> 8);
    n = n | (n >> 16);
    return n + 1;
}

function getCapacity( capacity ) {
    if( typeof capacity !== "number" ) return 16;
    return pow2AtLeast(
        Math.min(
            Math.max( 16, capacity ), 1073741824 )
    );
}

function Deque( capacity ) {
    this._capacity = getCapacity( capacity );
    this._length = 0;
    this._front = 0;
    this._makeCapacity();
}
var method = Deque.prototype;

method._willBeOverCapacity = function( size ) {
    return this._capacity < size;
};

method._pushOne = function( arg ) {
    var length = this.length();
    this._checkCapacity( length + 1 );
    var i = ( this._front + length ) & ( this._capacity - 1 );
    this[i] = arg;
    this._length = length + 1;
};

method.push = function( fn, receiver, arg ) {
    var length = this.length() + 3;
    if( this._willBeOverCapacity( length ) ) {
        this._pushOne( fn );
        this._pushOne( receiver );
        this._pushOne( arg );
        return;
    }
    var j = this._front + length - 3;
    this._checkCapacity( length );
    var wrapMask = this._capacity - 1;
    this[ ( j + 0 ) & wrapMask ] = fn;
    this[ ( j + 1 ) & wrapMask ] = receiver;
    this[ ( j + 2 ) & wrapMask ] = arg;
    this._length = length;
};

method.shift = function() {
    var front = this._front,
        ret = this[ front ];

    this[ front ] = void 0;
    this._front = ( front + 1 ) & ( this._capacity - 1 );
    this._length--;
    return ret;
};


method.length = function() {
    return this._length;
};

method._makeCapacity = function() {
    var len = this._capacity;
    for( var i = 0; i < len; ++i ) {
        this[i] = void 0;
    }
};

method._checkCapacity = function( size ) {
    if( this._capacity < size ) {
        this._resizeTo( this._capacity << 3 );
    }
};

method._resizeTo = function( capacity ) {
    var oldFront = this._front;
    var oldCapacity = this._capacity;
    var oldQueue = new Array( oldCapacity );
    var length = this.length();

    arrayCopy( this, 0, oldQueue, 0, oldCapacity );
    this._capacity = capacity;
    this._makeCapacity();
    this._front = 0;
    if( oldFront + length <= oldCapacity ) {
        arrayCopy( oldQueue, oldFront, this, 0, length );
    }
    else {        var lengthBeforeWrapping =
            length - ( ( oldFront + length ) & ( oldCapacity - 1 ) );

        arrayCopy( oldQueue, oldFront, this, 0, lengthBeforeWrapping );
        arrayCopy( oldQueue, 0, this, lengthBeforeWrapping,
                    length - lengthBeforeWrapping );
    }
};

return Deque;})();
function subError( constructorName, nameProperty, defaultMessage ) {
    defaultMessage = safeToEmbedString("" + defaultMessage );
    nameProperty = safeToEmbedString("" + nameProperty );

    return new Function("create", "'use strict';\n" +
         constructorName + ".prototype = create(Error.prototype);" +
         constructorName + ".prototype.constructor = "+constructorName+";" +
        "function "+constructorName+"(msg){" +
        "if( Error.captureStackTrace ) {" +
        "Error.captureStackTrace(this, this.constructor);" +
        "}" +
        "Error.call(this, msg);" +
        "this.message = typeof msg === 'string'" +
        "? msg" +
        ": '"+defaultMessage+"';" +
        "this.name = '"+nameProperty+"';" +
        "} return "+constructorName+";")(create);
}

if( typeof global.TypeError === "undefined" ) {
    global.TypeError = subError( "TypeError", "TypeError" );
}
var CancellationError = subError( "CancellationError",
    "Cancel", "cancellation error" );
var TimeoutError = subError( "TimeoutError", "Timeout", "timeout error" );
var CapturedTrace = (function() {

var rignore = new RegExp(
    "\\b(?:Promise(?:Array|Spawn)?\\$_\\w+|tryCatch(?:1|2|Apply)|setTimeout" +
    "|makeNodePromisified|processImmediate|nextTick" +
    "|Async\\$\\w+)\\b"
);

var rtraceline = null;
var formatStack = null;

function CapturedTrace( ignoreUntil, isTopLevel ) {
    this.captureStackTrace( ignoreUntil, isTopLevel );

}
var method = inherits( CapturedTrace, Error );

method.captureStackTrace =
function CapturedTrace$captureStackTrace( ignoreUntil, isTopLevel ) {
    captureStackTrace( this, ignoreUntil, isTopLevel );
};

CapturedTrace.possiblyUnhandledRejection =
function CapturedTrace$PossiblyUnhandledRejection( reason ) {
    if( typeof console === "object" ) {
        var stack = reason.stack;
        var message = "Possibly unhandled " + formatStack( stack, reason );
        if( typeof console.error === "function" ) {
            console.error( message );
        }
        else if( typeof console.log === "function" ) {
            console.log( message );
        }
    }
};

CapturedTrace.combine = function CapturedTrace$Combine( current, prev ) {
    var curLast = current.length - 1;
    for( var i = prev.length - 1; i >= 0; --i ) {
        var line = prev[i];
        if( current[ curLast ] === line ) {
            current.pop();
            curLast--;
        }
        else {
            break;
        }
    }
    current.push( "From previous event:" );
    var lines = current.concat( prev );

    var ret = [];


    for( var i = 0, len = lines.length; i < len; ++i ) {

        if( ( rignore.test( lines[i] ) ||
            ( i > 0 && !rtraceline.test( lines[i] ) ) &&
            lines[i] !== "From previous event:" )
        ) {
            continue;
        }
        ret.push( lines[i] );
    }
    return ret;
};

CapturedTrace.isSupported = function CapturedTrace$IsSupported() {
    return typeof captureStackTrace === "function";
};

var captureStackTrace = (function stackDetection() {
    if( typeof Error.stackTraceLimit === "number" &&
        typeof Error.captureStackTrace === "function" ) {
        rtraceline = /^\s*at\s*/;
        formatStack = function( stack, error ) {
            return ( typeof stack === "string" )
                ? stack
                : error.name + ". " + error.message;
        };
        var captureStackTrace = Error.captureStackTrace;
        return function CapturedTrace$_captureStackTrace(
            receiver, ignoreUntil, isTopLevel ) {
            var prev = -1;
            if( !isTopLevel ) {
                prev = Error.stackTraceLimit;
                Error.stackTraceLimit =
                    Math.max(1, Math.min(10000, prev) / 3 | 0);
            }
            captureStackTrace( receiver, ignoreUntil );

            if( !isTopLevel ) {
                Error.stackTraceLimit = prev;
            }
        };
    }
    var err = new Error();

    if( typeof err.stack === "string" &&
        typeof "".startsWith === "function" &&
        ( err.stack.startsWith("stackDetection@")) &&
        stackDetection.name === "stackDetection" ) {

        Object.defineProperty( Error, "stackTraceLimit", {
            writable: true,
            enumerable: false,
            configurable: false,
            value: 25
        });
        rtraceline = /@/;
        var rline = /[@\n]/;

        formatStack = function( stack, error ) {
            return ( typeof stack === "string" )
                ? ( error.name + ". " + error.message + "\n" + stack )
                : ( error.name + ". " + error.message );
        };

        return function captureStackTrace(o, fn) {
            var name = fn.name;
            var stack = new Error().stack;
            var split = stack.split( rline );
            var i, len = split.length;
            for (i = 0; i < len; i += 2) {
                if (split[i] === name) {
                    break;
                }
            }
            split = split.slice(i + 2);
            len = split.length - 2;
            var ret = "";
            for (i = 0; i < len; i += 2) {
                ret += split[i];
                ret += "@";
                ret += split[i + 1];
                ret += "\n";
            }
            o.stack = ret;
        };
    }
    else {
        return null;
    }
})();

return CapturedTrace;})();

function GetterCache(){}
function FunctionCache(){}


var getterCache = new GetterCache(),
    functionCache = new FunctionCache(),
    rjsident = /^[a-zA-Z$_][a-zA-Z0-9$_]*$/,
    rkeyword = new RegExp(
        "^(?:__proto__|undefined|NaN|Infinity|this|false|true|null|eval|" +
        "arguments|break|case|catch|continue|debugger|default|delete|do|" +
        "else|finally|for|function|if|in|instanceof|new|return|switch|th" +
        "row|try|typeof|var|void|while|with|class|enum|export|extends|im" +
        "port|super|implements|interface|let|package|private|protected|pu" +
        "blic|static|yield)$"
    ),
    hasProp = {}.hasOwnProperty;



function isJsIdentifier( val ) {
    return rjsident.test(val) &&
        !rkeyword.test(val);
}

function formatPropertyRead( val ) {
    if( isJsIdentifier(val) ) {
        return "." + val;
    }
    else {
        return "['"+safeToEmbedString(val)+"']";
    }
}

function getGetter( propertyName ) {
    if( hasProp.call( getterCache, propertyName ) ) {
        return getterCache[propertyName];
    }
    var fn = new Function("obj", "return obj"+
        formatPropertyRead(""+propertyName)
    +";");
    getterCache[propertyName] = fn;
    return fn;
}

function getFunction( propertyName ) {
    if( hasProp.call( functionCache, propertyName ) ) {
        return functionCache[propertyName];
    }
    var fn = new Function("obj", "return obj"+
        formatPropertyRead(""+propertyName)
    +"();");
    functionCache[propertyName] = fn;
    return fn;
}
var Async = (function() {

var deferFn;
if( typeof process !== "undefined" && process !== null &&
    typeof process.cwd === "function" ) {
    if( typeof global.setImmediate !== "undefined" ) {
        deferFn = function Promise$_Deferred( fn ) {
            global.setImmediate( fn );
        };
    }
    else {
        deferFn = function Promise$_Deferred( fn ) {
            process.nextTick( fn );
        };
    }
}
else if( ( typeof MutationObserver === "function" ||
        typeof WebkitMutationObserver === "function" ||
        typeof WebKitMutationObserver === "function" ) &&
        typeof document !== "undefined" &&
        typeof document.createElement === "function" ) {


    deferFn = (function(){
        var MutationObserver = global.MutationObserver ||
            global.WebkitMutationObserver ||
            global.WebKitMutationObserver;
        var div = document.createElement("div");
        var queuedFn = void 0;
        var observer = new MutationObserver(
            function Promise$_Deferred() {
                var fn = queuedFn;
                queuedFn = void 0;
                fn();
            }
        );
        var cur = true;
        observer.observe( div, {
            attributes: true,
            childList: true,
            characterData: true
        });
        return function Promise$_Deferred( fn ) {
            queuedFn = fn;
            cur = !cur;
            div.setAttribute( "class", cur ? "foo" : "bar" );
        };

    })();
}
else if ( typeof global.postMessage === "function" &&
    typeof global.importScripts !== "function" &&
    typeof global.addEventListener === "function" &&
    typeof global.removeEventListener === "function" ) {

    var MESSAGE_KEY = "bluebird_message_key_" + Math.random();
    deferFn = (function(){
        var queuedFn = void 0;

        function Promise$_Deferred(e) {
            if(e.source === global &&
                e.data === MESSAGE_KEY) {
                var fn = queuedFn;
                queuedFn = void 0;
                fn();
            }
        }

        global.addEventListener( "message", Promise$_Deferred, false );

        return function Promise$_Deferred( fn ) {
            queuedFn = fn;
            global.postMessage(
                MESSAGE_KEY, "*"
            );
        };

    })();
}
else if( typeof MessageChannel === "function" ) {
    deferFn = (function(){
        var queuedFn = void 0;

        var channel = new MessageChannel();
        channel.port1.onmessage = function Promise$_Deferred() {
                var fn = queuedFn;
                queuedFn = void 0;
                fn();
        };

        return function Promise$_Deferred( fn ) {
            queuedFn = fn;
            channel.port2.postMessage( null );
        };
    })();
}
else if( global.setTimeout ) {
    deferFn = function Promise$_Deferred( fn ) {
        setTimeout( fn, 4 );
    };
}
else {
    deferFn = function Promise$_Deferred( fn ) {
        fn();
    };
}

function Async() {
    this._isTickUsed = false;
    this._length = 0;
    this._lateBuffer = new Deque();
    this._functionBuffer = new Deque( 25000 * 3 );
    var self = this;
    this.consumeFunctionBuffer = function Async$consumeFunctionBuffer() {
        self._consumeFunctionBuffer();
    };
}
var method = Async.prototype;

method.haveItemsQueued = function Async$haveItemsQueued() {
    return this._length > 0;
};

method.invokeLater = function Async$invokeLater( fn, receiver, arg ) {
    this._lateBuffer.push( fn, receiver, arg );
    this._queueTick();
};

method.invoke = function Async$invoke( fn, receiver, arg ) {
    var functionBuffer = this._functionBuffer;
    functionBuffer.push( fn, receiver, arg );
    this._length = functionBuffer.length();
    this._queueTick();
};

method._consumeFunctionBuffer = function Async$_consumeFunctionBuffer() {
    var functionBuffer = this._functionBuffer;
    while( functionBuffer.length() > 0 ) {
        var fn = functionBuffer.shift();
        var receiver = functionBuffer.shift();
        var arg = functionBuffer.shift();
        fn.call( receiver, arg );
    }
    this._reset();
    this._consumeLateBuffer();
};

method._consumeLateBuffer = function Async$_consumeLateBuffer() {
    var buffer = this._lateBuffer;
    while( buffer.length() > 0 ) {
        var fn = buffer.shift();
        var receiver = buffer.shift();
        var arg = buffer.shift();
        var res = tryCatch1( fn, receiver, arg );
        if( res === errorObj ) {
            this._queueTick();
            throw res.e;
        }
    }
};

method._queueTick = function Async$_queue() {
    if( !this._isTickUsed ) {
        deferFn( this.consumeFunctionBuffer );
        this._isTickUsed = true;
    }
};

method._reset = function Async$_reset() {
    this._isTickUsed = false;
    this._length = 0;
};


return Async;})();

var async = new Async();
var Thenable = (function() {

function Thenable() {
    this.errorObj = errorObj;
    this.__id__ = 0;
    this.treshold = 1000;
    this.thenableCache = new Array( this.treshold );
    this.promiseCache = new Array( this.treshold );
    this._compactQueued = false;
}
var method = Thenable.prototype;

method.couldBe = function Thenable$couldBe( ret ) {
    if( ret === null ||
        typeof ret === "undefined" ||
        typeof ret === "string" ||
        typeof ret === "boolean" ||
        typeof ret === "number" ) {
        return false;
    }
    var id = ret.__id_$thenable__;
    if( typeof id === "number" &&
        this.thenableCache[id] !== void 0 ) {
        return true;
    }
    return ("then" in ret);
};

method.is = function Thenable$is( ret, ref ) {
    var id = ret.__id_$thenable__;
    if( typeof id === "number" &&
        this.thenableCache[id] !== void 0 ) {
        ref.ref = this.thenableCache[id];
        ref.promise = this.promiseCache[id];
        return true;
    }
    return this._thenableSlowCase( ret, ref );
};

method.addCache = function Thenable$_addCache( thenable, promise ) {
    var id = this.__id__;
    this.__id__ = id + 1;
    var descriptor = this._descriptor( id );
    Object.defineProperty( thenable, "__id_$thenable__", descriptor );
    this.thenableCache[id] = thenable;
    this.promiseCache[id] = promise;
    if( this.thenableCache.length > this.treshold &&
        !this._compactQueued) {
        this._compactQueued = true;
        async.invokeLater( this._compactCache, this, void 0 );
    }
};

method.deleteCache = function Thenable$deleteCache( thenable ) {
    var id = thenable.__id_$thenable__;
    if( id === -1 ) {
        return;
    }
    this.thenableCache[id] = void 0;
    this.promiseCache[id] = void 0;
    thenable.__id_$thenable__ = -1;};

var descriptor = {
    value: 0,
    enumerable: false,
    writable: true,
    configurable: true
};
method._descriptor = function Thenable$_descriptor( id ) {
    descriptor.value = id;
    return descriptor;
};

method._compactCache = function Thenable$_compactCache() {
    var arr = this.thenableCache;
    var promiseArr = this.promiseCache;
    var skips = 0;
    var j = 0;
    for( var i = 0, len = arr.length; i < len; ++i ) {
        var item = arr[ i ];
        if( item === void 0 ) {
            skips++;
        }
        else {
            promiseArr[ j ] = promiseArr[ i ];
            item.__id_$thenable__ = j;
            arr[ j++ ] = item;
        }
    }
    var newId = arr.length - skips;
    if( newId === this.__id__ ) {
        this.treshold *= 2;
    }
    else for( var i = newId, len = arr.length; i < len; ++i ) {
        promiseArr[ j ] = arr[i] = void 0;
    }

    this.__id__ = newId;
    this._compactQueued = false;
};

method._thenableSlowCase = function Thenable$_thenableSlowCase( ret, ref ) {
    try {
        var then = ret.then;
        if( typeof then === "function" ) {
            ref.ref = then;
            return true;
        }
        return false;
    }
    catch(e) {
        this.errorObj.e = e;
        ref.ref = this.errorObj;
        return true;
    }
};




return Thenable;})();
var CatchFilter = (function() {

function CatchFilter( instances, callback ) {
    this._instances = instances;
    this._callback = callback;
}
var method = CatchFilter.prototype;

method.doFilter = function CatchFilter$doFilter( e ) {
    if( e === null || typeof e !== "object" ) {
        throw e;
    }
    var cb = this._callback;
    for( var i = 0, len = this._instances.length; i < len; ++i ) {
        var item = this._instances[i];
        if( e instanceof item ) {
            var ret = tryCatch1( cb, void 0, e );
            if( ret === errorObj ) {
                throw ret.e;
            }
            return ret;
        }
    }
    throw e;
};

return CatchFilter;})();
var Promise = (function() {

function isObject( value ) {
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
var thenable = new Thenable( errorObj );

function Promise( resolver ) {
    if( typeof resolver === "function" )
        this._resolveResolver( resolver );


    this._bitField = 67108864;
    this._fulfill0 = void 0;
    this._reject0 = void 0;
    this._progress0 = void 0;
    this._promise0 = void 0;
    this._receiver0 = void 0;
    this._resolvedValue = void 0;
    this._cancellationParent = void 0;
    if( longStackTraces ) this._traceParent = this._peekContext();
}

var method = Promise.prototype;

var longStackTraces = false;
Promise.longStackTraces = function() {
    if( async.haveItemsQueued() &&
        longStackTraces === false
    ) {
        throw new Error("Cannot enable long stack traces " +
        "after promises have been created");
    }
    longStackTraces = true;
};

Promise.hasLongStackTraces = function() {
    return longStackTraces;
};

method._setTrace = function _setTrace( caller, parent ) {
    if( longStackTraces ) {
        var context = this._peekContext();
        var isTopLevel = context === void 0;
        if( parent !== void 0 &&
            parent._traceParent === context ) {
            this._trace = parent._trace;
        }
        else {
            this._trace = new CapturedTrace(
                typeof caller === "function"
                ? caller
                : _setTrace,
                isTopLevel
            );
        }
    }
    return this;
};

method.toString = function Promise$toString() {
    return "[object Promise]";
};


method.caught = method["catch"] = function Promise$catch( fn ) {
    var len = arguments.length;
    if( len > 1 ) {
        var catchInstances = new Array( len - 1 ),
            j = 0, i;
        for( i = 0; i < len - 1; ++i ) {
            var item = arguments[i];
            if( typeof item === "function" &&
                ( item.prototype instanceof Error ||
                item === Error ) ) {
                catchInstances[j++] = item;
            }
            else {
                var catchFilterTypeError =
                    new TypeError(
                        "A catch filter must be an error constructor");

                this._attachExtraTrace( catchFilterTypeError );
                this._reject(catchFilterTypeError);
                return;
            }
        }
        catchInstances.length = j;
        fn = arguments[i];
        var catchFilter = new CatchFilter( catchInstances, fn );
        return this._then( void 0, catchFilter.doFilter, void 0,
            catchFilter, void 0, this.caught );
    }
    return this._then( void 0, fn, void 0, void 0, void 0, this.caught );
};

method.progressed = function Promise$progressed( fn ) {
    return this._then( void 0, void 0, fn, void 0, void 0, this.progressed );
};


function thrower( r ) {
    throw r;
}
function slowFinally( ret, reasonOrValue ) {
    if( this.isFulfilled() ) {
        return ret._then(function() {
            return reasonOrValue;
        }, thrower, void 0, this, void 0, slowFinally );
    }
    else {
        return ret._then(function() {
            throw reasonOrValue;
        }, thrower, void 0, this, void 0, slowFinally );
    }
}
method.lastly = method["finally"] = function Promise$finally( fn ) {
    var r = function( reasonOrValue ) {
        var ret = fn( reasonOrValue );
        if( isPromise( ret ) ) {
            return slowFinally.call( this, ret, reasonOrValue );
        }
        if( this.isRejected() ) throw reasonOrValue;
        return reasonOrValue;
    };
    return this._then( r, r, void 0, this, void 0, this.lastly );
};

method.inspect = function Promise$inspect() {
    return new PromiseInspection( this );
};

method.cancel = function Promise$cancel() {
    if( !this.isCancellable() ) return this;
    var cancelTarget = this;
    while( cancelTarget._cancellationParent !== void 0 ) {
        cancelTarget = cancelTarget._cancellationParent;
    }
    if( cancelTarget === this ) {
        var err = new CancellationError();
        this._attachExtraTrace( err );
        this._reject( err );
    }
    else {
        cancelTarget.cancel((void 0));
    }
    return this;
};

method.uncancellable = function Promise$uncancellable() {
    var ret = new Promise();
    ret._setTrace( this.uncancellable, this );
    ret._unsetCancellable();
    ret._assumeStateOf( this, true );
    return ret;
};

method.fork = function Promise$fork( didFulfill, didReject, didProgress ) {
    var ret = this._then( didFulfill, didReject, didProgress,
        void 0, void 0, this.fork );
    ret._cancellationParent = void 0;
    return ret;
};

method.call = function Promise$call( propertyName ) {
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

method.get = function Promise$get( propertyName ) {
    return this._then(
        getGetter( propertyName ),
        void 0,
        void 0,
        void 0,
        void 0,
        this.get
    );
};

method.then = function Promise$then( didFulfill, didReject, didProgress ) {
    return this._then( didFulfill, didReject, didProgress,
        void 0, void 0, this.then );
};

method.done = function Promise$done( didFulfill, didReject, didProgress ) {
    var promise = this._then( didFulfill, didReject, didProgress,
        void 0, void 0, this.done );
    promise._setIsFinal();
};

method.spread = function Promise$spread( didFulfill, didReject ) {
    return this._then( didFulfill, didReject, void 0,
        APPLY, void 0, this.spread );
};
method.isFulfilled = function Promise$isFulfilled() {
    return ( this._bitField & 268435456 ) > 0;
};

method.isRejected = function Promise$isRejected() {
    return ( this._bitField & 134217728 ) > 0;
};

method.isPending = function Promise$isPending() {
    return !this.isResolved();
};

method.isResolved = function Promise$isResolved() {
    return ( this._bitField & 402653184 ) > 0;
};

method.isCancellable = function Promise$isCancellable() {
    return !this.isResolved() &&
        this._cancellable();
};

method.toJSON = function Promise$toJSON() {
    var inspection = this.inspect();
    var ret = {
        isFulfilled: false,
        isRejected: false
    };
    if( inspection.isFulfilled() ) {
        ret.fulfillmentValue = inspection.value();
        ret.isFulfilled = true;
    }
    else if( inspection.isRejected() ) {
        ret.rejectionReason = inspection.error();
        ret.isRejected = true;
    }
    return ret;
};

function Promise$_successAdapter( val ) {
    var nodeback = this;
    var ret = tryCatch2( nodeback, void 0, null, val );
    if( ret === errorObj ) {
        async.invokeLater( thrower, void 0, ret.e );
    }
}
function Promise$_errorAdapter( reason ) {
    var nodeback = this;
    var ret = tryCatch1( nodeback, void 0, reason );
    if( ret === errorObj ) {
        async.invokeLater( thrower, void 0, ret.e );
    }
}

method.nodeify = function Promise$nodeify( nodeback ) {
    if( typeof nodeback == "function" ) {
        this._then(
            Promise$_successAdapter,
            Promise$_errorAdapter,
            void 0,
            nodeback,
            null,
            this.nodeify
        );
    }
    return this;
};

function apiRejection( msg ) {
    var error = new TypeError( msg );
    var ret = Promise.rejected( error );
    var parent = ret._peekContext();
    if( parent != null ) {
        parent._attachExtraTrace( error );
    }
    return ret;
}

method.map = function Promise$map( fn ) {
    return Promise.map( this, fn );
};

method.all = function Promise$all() {
    return Promise.all( this );
};

method.any = function Promise$any() {
    return Promise.any( this );
};

method.settle = function Promise$settle() {
    return Promise.settle( this );
};

method.some = function Promise$some( count ) {
    return Promise.some( this, count );
};

method.reduce = function Promise$reduce( fn, initialValue ) {
    return Promise.reduce( this, fn, initialValue );
};

Promise.is = isPromise;

Promise.settle = function Promise$Settle( promises ) {
    var ret = Promise._all( promises, SettledPromiseArray );
    return ret.promise();
};

Promise.all = function Promise$All( promises ) {
    var ret = Promise._all( promises, PromiseArray );
    return ret.promise();
};

Promise.join = function Promise$Join() {
    var ret = new Array( arguments.length );
    for( var i = 0, len = ret.length; i < len; ++i ) {
        ret[i] = arguments[i];
    }
    return Promise._all( ret, PromiseArray ).promise();
};

Promise.any = function Promise$Any( promises ) {
    var ret = Promise._all( promises, AnyPromiseArray );
    return ret.promise();
};

Promise.some = function Promise$Some( promises, howMany ) {
    if( ( howMany | 0 ) !== howMany ) {
        return apiRejection("howMany must be an integer");
    }
    var ret = Promise._all( promises, SomePromiseArray );
    var len = ret.length();
    howMany = Math.max(0, Math.min( howMany, len ) );
    ret._howMany = howMany;
    return ret.promise();
};


function mapper( fulfilleds ) {
    var fn = this;
    var shouldDefer = false;
    for( var i = 0, len = fulfilleds.length; i < len; ++i ) {
        if( fulfilleds[i] === void 0 &&
            !(i in fulfilleds) ) {
            continue;
        }
        var fulfill = fn( fulfilleds[ i ], i, len );
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
Promise.map = function Promise$Map( promises, fn ) {
    if( typeof fn !== "function" ) {
        return apiRejection( "fn is not a function" );
    }
    return Promise.all( promises )._then(
        mapper,
        void 0,
        void 0,
        fn,
        void 0,
        Promise.map
    );
};

function reducer( fulfilleds, initialValue ) {
    var fn = this;
    var len = fulfilleds.length;
    var accum = void 0;
    var startIndex = 0;

    if( initialValue !== void 0 ) {
        accum = initialValue;
        startIndex = 0;
    }
    else {
        startIndex = 1;
        if( len > 0 ) {
            for( var i = 0; i < len; ++i ) {
                if( fulfilleds[i] === void 0 &&
                    !(i in fulfilleds) ) {
                    continue;
                }
                accum = fulfilleds[i];
                startIndex = i + 1;
                break;
            }
        }
    }
    for( var i = startIndex; i < len; ++i ) {
        if( fulfilleds[i] === void 0 &&
            !(i in fulfilleds) ) {
            continue;
        }
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


Promise.reduce = function Promise$Reduce( promises, fn, initialValue ) {
    if( typeof fn !== "function" ) {
        return apiRejection( "fn is not a function" );
    }
    if( initialValue !== void 0 ) {
        return slowReduce( promises, fn, initialValue );
    }
    return Promise
        .all( promises )
        ._then( reducer, void 0, void 0, fn, void 0, Promise.all );
};

Promise.fulfilled = function Promise$Fulfilled( value, caller ) {
    var ret = new Promise();
    ret._setTrace( typeof caller === "function"
        ? caller
        : Promise.fulfilled, void 0 );
    if( ret._tryAssumeStateOf( value, false ) ) {
        return ret;
    }
    ret._cleanValues();
    ret._setFulfilled();
    ret._resolvedValue = value;
    return ret;
};

Promise.rejected = function Promise$Rejected( reason ) {
    var ret = new Promise();
    ret._setTrace( Promise.rejected, void 0 );
    ret._cleanValues();
    ret._setRejected();
    ret._resolvedValue = reason;
    return ret;
};

Promise.pending = function Promise$Pending( caller ) {
    var promise = new Promise();
    promise._setTrace( caller, void 0 );
    return new PromiseResolver( promise );
};


Promise._cast = cast;
Promise.cast = function Promise$Cast( obj, caller ) {
    var ret = cast( obj, caller );
    if( !( ret instanceof Promise ) ) {
        return Promise.fulfilled( ret, caller );
    }
    return ret;
};

Promise["try"] = Promise.attempt = function( fn ) {
    return Promise.fulfilled().then( fn );
};

Promise.onPossiblyUnhandledRejection =
function Promise$OnPossiblyUnhandledRejection( fn ) {
    if( typeof fn === "function" ) {
        CapturedTrace.possiblyUnhandledRejection = fn;
    }
    else {
        CapturedTrace.possiblyUnhandledRejection = void 0;
    }
};

Promise.coroutine = function Promise$Coroutine( generatorFunction ) {
     if( typeof generatorFunction !== "function" ) {
        throw new TypeError( "generatorFunction must be a function" );
    }
    var PromiseSpawn$ = PromiseSpawn;
    return function anonymous() {
        var generator = generatorFunction.apply( this, arguments );
        var spawn = new PromiseSpawn$( void 0, void 0, anonymous );
        spawn._generator = generator;
        spawn._next( void 0 );
        return spawn.promise();
    };
};

Promise.spawn = function Promise$Spawn( generatorFunction ) {
    if( typeof generatorFunction !== "function" ) {
        return apiRejection( "generatorFunction must be a function" );
    }
    var spawn = new PromiseSpawn( generatorFunction, this, Promise.spawn );
    var ret = spawn.promise();
    spawn._run( Promise.spawn );
    return ret;
};

function f(){}
function isPromisified( fn ) {
    return fn.__isPromisified__ === true;
}
var hasProp = {}.hasOwnProperty;
var roriginal = new RegExp( "__beforePromisified__" + "$" );
function _promisify( callback, receiver, isAll ) {
    if( isAll ) {
        var changed = 0;
        var o = {};
        for( var key in callback ) {
            if( rjsident.test( key ) &&
                !roriginal.test( key ) &&
                !hasProp.call( callback,
                    ( key + "__beforePromisified__" ) ) &&
                typeof callback[ key ] === "function" ) {
                var fn = callback[key];
                if( !isPromisified( fn ) ) {
                    changed++;
                    var originalKey = key + "__beforePromisified__";
                    var promisifiedKey = key + "Async";
                    notEnumerableProp( callback, originalKey, fn );
                    o[ promisifiedKey ] =
                        makeNodePromisified( originalKey, THIS, key );
                }
            }
        }
        if( changed > 0 ) {
            for( var key in o ) {
                if( hasProp.call( o, key ) ) {
                    callback[key] = o[key];
                }
            }
            f.prototype = callback;
        }

        return callback;
    }
    else {
        return makeNodePromisified( callback, receiver, void 0 );
    }
}
Promise.promisify = function Promise$Promisify( callback, receiver ) {
    if( typeof callback === "object" && callback !== null ) {
        deprecated( "Promise.promisify for promisifying entire objects " +
            "is deprecated. Use Promise.promisifyAll instead." );
        return _promisify( callback, receiver, true );
    }
    if( typeof callback !== "function" ) {
        throw new TypeError( "callback must be a function" );
    }
    if( isPromisified( callback ) ) {
        return callback;
    }
    return _promisify(
        callback,
        arguments.length < 2 ? THIS : receiver,
        false );
};

Promise.promisifyAll = function Promise$PromisifyAll( target ) {
    if( typeof target !== "function" && typeof target !== "object" ) {
        throw new TypeError( "Cannot promisify " + typeof target );
    }
    return _promisify( target, void 0, true );
};

method._then =
function Promise$_then(
    didFulfill,
    didReject,
    didProgress,
    receiver,
    internalData,
    caller
) {
    var haveInternalData = internalData !== void 0;
    var ret = haveInternalData ? internalData : new Promise();

    if( longStackTraces && !haveInternalData ) {
        var haveSameContext = this._peekContext() === this._traceParent;
        ret._traceParent = haveSameContext ? this._traceParent : this;
        ret._setTrace( typeof caller === "function" ?
            caller : this._then, this );

    }

    var callbackIndex =
        this._addCallbacks( didFulfill, didReject, didProgress, ret, receiver );

    if( this.isResolved() ) {
        this._resolveLast(callbackIndex);
    }
    else if( !haveInternalData && this.isCancellable() ) {
        ret._cancellationParent = this;
    }

    if( this._isDelegated() ) {
        this._unsetDelegated();
        var x = this._resolvedValue;
        if( !this._tryThenable( x ) ) {
            this._fulfill(x);
        }
    }
    return ret;
};

method._length = function Promise$_length() {
    return this._bitField & 16777215;
};

method._isFollowingOrFulfilledOrRejected =
function Promise$_isFollowingOrFulfilledOrRejected() {
    return ( this._bitField & 939524096 ) > 0;
};

method._setLength = function Promise$_setLength( len ) {
    this._bitField = ( this._bitField & -16777216 ) |
        ( len & 16777215 ) ;
};

method._cancellable = function Promise$_cancellable() {
    return ( this._bitField & 67108864 ) > 0;
};

method._setFulfilled = function Promise$_setFulfilled() {
    this._bitField = this._bitField | 268435456;
};

method._setRejected = function Promise$_setRejected() {
    this._bitField = this._bitField | 134217728;
};

method._setFollowing = function Promise$_setFollowing() {
    this._bitField = this._bitField | 536870912;
};

method._setDelegated = function Promise$_setDelegated() {
    this._bitField = this._bitField | -1073741824;
};

method._setIsFinal = function Promise$_setIsFinal() {
    this._bitField = this._bitField | 33554432;
};

method._isFinal = function Promise$_isFinal() {
    return ( this._bitField & 33554432 ) > 0;
};

method._isDelegated = function Promise$_isDelegated() {
    return ( this._bitField & -1073741824 ) === -1073741824;
};

method._unsetDelegated = function Promise$_unsetDelegated() {
    this._bitField = this._bitField & ( ~-1073741824 );
};

method._setCancellable = function Promise$_setCancellable() {
    this._bitField = this._bitField | 67108864;
};

method._unsetCancellable = function Promise$_unsetCancellable() {
    this._bitField = this._bitField & ( ~67108864 );
};

method._receiverAt = function Promise$_receiverAt( index ) {
    if( index === 0 ) return this._receiver0;
    return this[ index + 4 - 5 ];
};

method._promiseAt = function Promise$_promiseAt( index ) {
    if( index === 0 ) return this._promise0;
    return this[ index + 3 - 5 ];
};

method._fulfillAt = function Promise$_fulfillAt( index ) {
    if( index === 0 ) return this._fulfill0;
    return this[ index + 0 - 5 ];
};

method._rejectAt = function Promise$_rejectAt( index ) {
    if( index === 0 ) return this._reject0;
    return this[ index + 1 - 5 ];
};

method._progressAt = function Promise$_progressAt( index ) {
    if( index === 0 ) return this._progress0;
    return this[ index + 2 - 5 ];
};

method._unsetAt = function Promise$_unsetAt( index ) {
    if( index === 0 ) {
        this._fulfill0 =
        this._reject0 =
        this._progress0 =
        this._promise0 =
        this._receiver0 = void 0;
    }
    else {
        this[ index - 5 + 0 ] =
        this[ index - 5 + 1 ] =
        this[ index - 5 + 2 ] =
        this[ index - 5 + 3 ] =
        this[ index - 5 + 4 ] = void 0;
    }
};

var fulfiller = new Function("p",
    "'use strict';return function Promise$_fulfiller(a){ p.fulfill( a ); }" );
var rejecter = new Function("p",
    "'use strict';return function Promise$_rejecter(a){ p.reject( a ); }" );

method._resolveResolver = function Promise$_resolveResolver( resolver ) {
    this._setTrace( this._resolveResolver, void 0 );
    var p = new PromiseResolver( this );
    this._pushContext();
    var r = tryCatch2( resolver, this, fulfiller( p ), rejecter( p ) );
    this._popContext();
    if( r === errorObj ) {
        p.reject( r.e );
    }
};

method._addCallbacks = function Promise$_addCallbacks(
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

    if( index === 0 ) {
        this._fulfill0 = fulfill;
        this._reject0  = reject;
        this._progress0 = progress;
        this._promise0 = promise;
        this._receiver0 = receiver;
        this._setLength( index + 5 );
        return index;
    }

    this[ index - 5 + 0 ] = fulfill;
    this[ index - 5 + 1 ] = reject;
    this[ index - 5 + 2 ] = progress;
    this[ index - 5 + 3 ] = promise;
    this[ index - 5 + 4 ] = receiver;

    this._setLength( index + 5 );
    return index;
};

method._callFast = function Promise$_callFast( propertyName ) {
    return this._then(
        getFunction( propertyName ),
        void 0,
        void 0,
        void 0,
        void 0,
        this.call
    );
};

method._callSlow = function Promise$_callSlow( propertyName, args ) {
    return this._then( function( obj ) {
        return obj[propertyName].apply( obj, args );
    },
        void 0,
        void 0,
        void 0,
        void 0,
        this.call
    );
};

method._spreadSlowCase =
function Promise$_spreadSlowCase( targetFn, promise, values ) {
    promise._assumeStateOf(
        Promise.all( values )._then( targetFn, void 0, void 0, APPLY, void 0,
            this._spreadSlowCase ),
        false
    );
};


function cast( obj, caller ) {
    if( isObject( obj ) ) {
        if( obj instanceof Promise ) {
            return obj;
        }
        var ref = { ref: null, promise: null };
        if( thenable.is( obj, ref ) ) {
            if( ref.promise != null ) {
                return ref.promise;
            }
            var resolver = Promise.pending( caller );
            var result = ref.ref;
            if( result === errorObj ) {
                resolver.reject( result.e );
                return resolver.promise;
            }
            thenable.addCache( obj, resolver.promise );
            var called = false;
            var ret = tryCatch2( result, obj, function t( a ) {
                if( called ) return;
                called = true;
                thenable.deleteCache(obj);
                var b = cast( a );
                if( b === a ) {
                    resolver.fulfill( a );
                }
                else {
                    if( a === obj ) {
                        resolver.promise._resolveFulfill( a );
                    }
                    else {
                        b._then(
                            resolver.fulfill,
                            resolver.reject,
                            void 0,
                            resolver,
                            void 0,
                            t
                        );
                    }
                }
            }, function t( a ) {
                if( called ) return;
                called = true;
                thenable.deleteCache(obj);
                resolver.reject( a );
            });
            if( ret === errorObj && !called ) {
                resolver.reject( ret.e );
                thenable.deleteCache(obj);
            }
            return resolver.promise;
        }
    }
    return obj;
}

method._resolveThenable = function Promise$_resolveThenable( x, ref ) {
    if( ref.promise != null ) {
        this._assumeStateOf( ref.promise, true );
        return;
    }
    if( ref.ref === errorObj ) {
        this._attachExtraTrace( ref.ref.e );
        this._reject(ref.ref.e);
    }
    else {
        thenable.addCache( x, this );
        var then = ref.ref;
        var localX = x;
        var localP = this;
        var key = {};
        var called = false;
        var t = function t( v ) {
            if( called && this !== key ) return;
            called = true;
            var fn = localP._fulfill;
            var b = cast( v );

            if( b !== v ||
                ( b instanceof Promise && b.isPending() ) ) {
                if( v === x ) {
                    fn.call(localP, v);
                    thenable.deleteCache(localX);
                }
                else {
                    b._then( t, r, void 0, key, void 0, t);
                }
                return;
            }


            if( b instanceof Promise ) {
                var fn = b.isFulfilled()
                    ? localP._fulfill : localP._reject;
                v = v._resolvedValue;
                b = cast( v );
                if( b !== v ||
                    ( b instanceof Promise && b !== v ) ) {
                    b._then( t, r, void 0, key, void 0, t);
                    return;
                }
            }
            fn.call(localP, v);
            thenable.deleteCache(localX);
        };

        var r = function r( v ) {
            if( called && this !== key ) return;
            var fn = localP._reject;
            called = true;

            var b = cast( v );

            if( b !== v ||
                ( b instanceof Promise && b.isPending() ) ) {
                if( v === x ) {
                    fn.call(localP, v);
                    thenable.deleteCache(localX);
                }
                else {
                    b._then( t, r, void 0, key, void 0, t);
                }
                return;
            }


            if( b instanceof Promise ) {
                var fn = b.isFulfilled()
                    ? localP._fulfill : localP._reject;
                v = v._resolvedValue;
                b = cast( v );
                if( b !== v ||
                    ( b instanceof Promise && b.isPending() ) ) {
                    b._then( t, r, void 0, key, void 0, t);
                    return;
                }
            }

            fn.call(localP, v);
            thenable.deleteCache(localX);

        };
        var threw = tryCatch2( then, x, t, r);
        if( threw === errorObj &&
            !called ) {
            this._attachExtraTrace( threw.e );
            this._reject(threw.e);
            thenable.deleteCache(x);
        }
    }
};

method._tryThenable = function Promise$_tryThenable( x ) {
    var ref;
    if( !thenable.is( x, ref = {ref: null, promise: null} ) ) {
        return false;
    }
    this._resolveThenable( x, ref );
    return true;
};

var ignore = CatchFilter.prototype.doFilter;
method._resolvePromise = function Promise$_resolvePromise(
    onFulfilledOrRejected, receiver, value, promise
) {
    if( isError( value ) ) {
        value.__handled = true;
    }

    if( !isPromise( promise ) ) {
        return onFulfilledOrRejected.call( receiver, value, promise );
    }

    var x;
    if( receiver === APPLY ) {
        if( isArray( value ) ) {
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
            promise._pushContext();
            x = tryCatchApply( onFulfilledOrRejected, value );
        }
        else {
            this._spreadSlowCase( onFulfilledOrRejected, promise, value );
            return;
        }
    }
    else {
        promise._pushContext();
        x = tryCatch1( onFulfilledOrRejected, receiver, value );
    }

    promise._popContext();

    if( x === errorObj ) {
        if( onFulfilledOrRejected !== ignore ) {
            promise._attachExtraTrace( x.e );
        }
        promise._reject(x.e);
    }
    else if( x === promise ) {
        var selfResolutionError =
            new TypeError( "Circular thenable chain" );
        this._attachExtraTrace( selfResolutionError );
        promise._reject(selfResolutionError);
    }
    else {
        if( promise._tryAssumeStateOf( x, true ) ) {
            return;
        }
        else if( thenable.couldBe( x ) ) {

            if( promise._length() === 0 ) {
                promise._resolvedValue = x;
                promise._setDelegated();
                return;
            }
            else if( promise._tryThenable( x ) ) {
                return;
            }
        }
        promise._fulfill(x);
    }
};

method._assumeStateOf =
function Promise$_assumeStateOf( promise, mustAsync ) {
    this._setFollowing();
    if( promise.isPending() ) {
        if( promise._cancellable()  ) {
            this._cancellationParent = promise;
        }
        promise._then(
            this._resolveFulfill,
            this._resolveReject,
            this._resolveProgress,
            this,
            void 0,
            this._tryAssumeStateOf
        );
    }
    else if( promise.isFulfilled() ) {
        if( mustAsync )
            this._resolveFulfill(promise._resolvedValue);
        else
            this._resolveFulfill( promise._resolvedValue );
    }
    else {
        if( mustAsync )
            this._resolveReject(promise._resolvedValue);
        else
            this._resolveReject( promise._resolvedValue );
    }

    if( longStackTraces &&
        promise._traceParent == null ) {
        promise._traceParent = this;
    }
};

method._tryAssumeStateOf =
function Promise$_tryAssumeStateOf( value, mustAsync ) {
    if( !isPromise( value ) ||
        this._isFollowingOrFulfilledOrRejected() ) return false;

    this._assumeStateOf( value, mustAsync );
    return true;
};



method._attachExtraTrace = function Promise$_attachExtraTrace( error ) {
    if( longStackTraces &&
        isError( error ) ) {
        var promise = this;
        var stack = error.stack;
        stack = stack ? stack.split("\n") : [];
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

method._notifyUnhandledRejection =
function Promise$_notifyUnhandledRejection( reason ) {
    if( !reason.__handled ) {
        reason.__handled = true;
        CapturedTrace.possiblyUnhandledRejection( reason );
    }
};

method._unhandledRejection = function Promise$_unhandledRejection( reason ) {
    if( !reason.__handled ) {
        async.invokeLater( this._notifyUnhandledRejection, this, reason );
    }
};

method._cleanValues = function Promise$_cleanValues() {
    this._cancellationParent = void 0;
};

method._fulfill = function Promise$_fulfill( value ) {
    if( this._isFollowingOrFulfilledOrRejected() ) return;
    this._resolveFulfill( value );

};

method._reject = function Promise$_reject( reason ) {
    if( this._isFollowingOrFulfilledOrRejected() ) return;
    this._resolveReject( reason );
};

method._progress = function Promise$_progress( progressValue ) {
    if( this._isFollowingOrFulfilledOrRejected() ) return;
    this._resolveProgress( progressValue );

};



method._doResolveAt = function Promise$_doResolveAt( i ) {
    var fn = this.isFulfilled()
        ? this._fulfillAt( i )
        : this._rejectAt( i );
    var value = this._resolvedValue;
    var receiver = this._receiverAt( i );
    var promise = this._promiseAt( i );
    this._unsetAt( i );
    this._resolvePromise( fn, receiver, value, promise );
};

method._resolveFulfill = function Promise$_resolveFulfill( value ) {
    this._cleanValues();
    this._setFulfilled();
    this._resolvedValue = value;
    var len = this._length();
    for( var i = 0; i < len; i+= 5 ) {
        if( this._fulfillAt( i ) !== void 0 ) {
            this._doResolveAt(i);
        }
        else {
            var promise = this._promiseAt( i );
            this._unsetAt( i );
            promise._fulfill(value);
        }
    }
};

method._resolveLast = function Promise$_resolveLast( index ) {
    var fn;
    if( this.isFulfilled() ) {
        fn = this._fulfillAt( index );
    }
    else {
        fn = this._rejectAt( index );
    }
    if( fn !== void 0 ) {
        this._doResolveAt(index);
    }
    else {
        var promise = this._promiseAt( index );
        var value = this._resolvedValue;
        this._unsetAt( index );
        if( this.isFulfilled() ) {
            promise._fulfill(value);
        }
        else {
            promise._reject(value);
        }
    }
};

method._resolveReject = function Promise$_resolveReject( reason ) {
    this._cleanValues();
    this._setRejected();
    this._resolvedValue = reason;

    if( this._isFinal() ) {
        async.invokeLater( thrower, void 0, reason );
        return;
    }

    var len = this._length();
    var rejectionWasHandled = false;
    for( var i = 0; i < len; i+= 5 ) {
        if( this._rejectAt( i ) !== void 0 ) {
            rejectionWasHandled = true;
            this._doResolveAt(i);
        }
        else {
            var promise = this._promiseAt( i );
            this._unsetAt( i );
            if( !rejectionWasHandled )
                rejectionWasHandled = promise._length() > 0;
            promise._reject(reason);
        }
    }

    if( !rejectionWasHandled &&
        isError( reason ) &&
        CapturedTrace.possiblyUnhandledRejection !== void 0
    ) {
        if( reason.__handled !== true ) {
            reason.__handled = false;
            this._unhandledRejection(reason);
        }
    }

};

method._resolveProgress = function Promise$_resolveProgress( progressValue ) {
    var len = this._length();
    for( var i = 0; i < len; i += 5 ) {
        var fn = this._progressAt( i );
        var promise = this._promiseAt( i );
        if( !isPromise( promise ) ) {
            fn.call( this._receiverAt( i ), progressValue, promise );
            continue;
        }
        var ret = progressValue;
        if( fn !== void 0 ) {
            this._pushContext();
            ret = tryCatch1( fn, this._receiverAt( i ), progressValue );
            this._popContext();
            if( ret === errorObj ) {
                if( ret.e != null &&
                    ret.e.name === "StopProgressPropagation" ) {
                    ret.e.__handled = true;
                }
                else {
                    promise._attachExtraTrace( ret.e );
                    promise._progress(ret.e);
                }
            }
            else if( isPromise( ret ) ) {
                ret._then( promise._progress, null, null, promise, void 0,
                    this._progress );
            }
            else {
                promise._progress(ret);
            }
        }
        else {
            promise._progress(ret);
        }
    }
};

var contextStack = [];
method._peekContext = function Promise$_peekContext() {
    var lastIndex = contextStack.length - 1;
    if( lastIndex >= 0 ) {
        return contextStack[ lastIndex ];
    }
    return void 0;

};

method._pushContext = function Promise$_pushContext() {
    if( !longStackTraces ) return;
    contextStack.push( this );
};

method._popContext = function Promise$_popContext() {
    if( !longStackTraces ) return;
    contextStack.pop();
};


Promise._all =
function Promise$_All( promises, PromiseArray, caller ) {
    if( isPromise( promises ) ||
        isArray( promises ) ) {

        return new PromiseArray( promises,
            typeof caller === "function"
            ? caller
            : Promise$_All
        );
    }
    return new PromiseArray(
        [ apiRejection( "expecting an array or a promise" ) ] );
};

var old = global.Promise;

Promise.noConflict = function() {
    if( global.Promise === Promise ) {
        global.Promise = old;
    }
    return Promise;
};


if( !CapturedTrace.isSupported() ) {
    Promise.longStackTraces = function(){};
    CapturedTrace.possiblyUnhandledRejection = function(){};
    Promise.onPossiblyUnhandledRejection = function(){};
    longStackTraces = false;
}


Promise.CancellationError = CancellationError;
Promise.TimeoutError = TimeoutError;
Promise.TypeError = TypeError;



return Promise;})();



var PromiseArray = (function() {

function nullToUndefined( val ) {
    return val === null
        ? void 0
        : val;
}

var hasOwn = {}.hasOwnProperty;
var empty = [];

function isPromise( obj ) {
    if( typeof obj !== "object" ) return false;
    return obj instanceof Promise;
}

var Arr = Array;
var isArray = Arr.isArray || function( obj ) {
    return obj instanceof Arr;
};

function PromiseArray( values, caller ) {
    this._values = values;
    this._resolver = Promise.pending( caller );
    this._length = 0;
    this._totalResolved = 0;
    this._init( void 0, empty );
}
var method = PromiseArray.prototype;

method.length = function PromiseArray$length() {
    return this._length;
};

method.promise = function PromiseArray$promise() {
    return this._resolver.promise;
};


method._init = function PromiseArray$_init( _, fulfillValueIfEmpty ) {
    var values = this._values;
    if( isPromise( values ) ) {
        if( values.isPending() ) {
            values._then(
                this._init,
                this._reject,
                void 0,
                this,
                fulfillValueIfEmpty,
                this.constructor
            );
            return;
        }
        else if( values.isRejected() ) {
            this._reject( values._resolvedValue );
            return;
        }
        else {
            values = values._resolvedValue;
            if( !isArray( values ) ) {
                this._fulfill( nullToUndefined( fulfillValueIfEmpty ) );
                return;
            }
            this._values = values;
        }

    }
    if( !values.length ) {
        this._fulfill( nullToUndefined( fulfillValueIfEmpty ) );
        return;
    }
    var len = values.length;
    var newLen = len;
    var newValues = new Array( len );
    for( var i = 0; i < len; ++i ) {
        var promise = values[i];

        if( promise === void 0 && !hasOwn.call( values, i ) ) {
            newLen--;
            continue;
        }

        promise = Promise.cast( promise );

        promise._then(
            this._promiseFulfilled,
            this._promiseRejected,
            this._promiseProgressed,

            this,            Integer.get( i ),             this.constructor



        );
        newValues[i] = promise;
    }
    this._values = newValues;
    this._length = newLen;
};

method._isResolved = function PromiseArray$_isResolved() {
    return this._values === null;
};

method._fulfill = function PromiseArray$_fulfill( value ) {
    this._values = null;
    this._resolver.fulfill( value );
};

method._reject = function PromiseArray$_reject( reason ) {
    this._values = null;
    this._resolver.reject( reason );
};

method._promiseProgressed =
function PromiseArray$_promiseProgressed( progressValue, index ) {
    if( this._isResolved() ) return;
    this._resolver.progress({
        index: index.valueOf(),
        value: progressValue
    });
};

method._promiseFulfilled =
function PromiseArray$_promiseFulfilled( value, index ) {
    if( this._isResolved() ) return;
    this._values[ index.valueOf() ] = value;
    var totalResolved = ++this._totalResolved;
    if( totalResolved >= this._length ) {
        this._fulfill( this._values );
    }
};

method._promiseRejected =
function PromiseArray$_promiseRejected( reason ) {
    if( this._isResolved() ) return;
    this._totalResolved++;
    this._reject( reason );
};

function Integer( value ) {
    this._value = value;
}

Integer.prototype.valueOf = function Integer$valueOf() {
    return this._value;
};
Integer.get = function Integer$get( i ) {
    if( i < 256 ) {
        return ints[i];
    }
    return new Integer(i);
};

var ints = [];
for( var i = 0; i < 256; ++i ) {
    ints.push( new Integer(i) );
}





return PromiseArray;})();
var SettledPromiseArray = (function() {
function SettledPromiseArray( values, caller ) {
    this.constructor$( values, caller );
}
var method = inherits( SettledPromiseArray, PromiseArray );



method._promiseResolved =
function SettledPromiseArray$_promiseResolved( index, inspection ) {
    this._values[ index ] = inspection;
    var totalResolved = ++this._totalResolved;
    if( totalResolved >= this._length ) {
        this._fulfill( this._values );
    }
};

var throwawayPromise = new Promise()._setTrace();
method._promiseFulfilled =
function SettledPromiseArray$_promiseFulfilled( value, index ) {
    if( this._isResolved() ) return;
    var ret = new PromiseInspection( throwawayPromise );
    ret._bitField = 268435456;
    ret._resolvedValue = value;
    this._promiseResolved( index.valueOf(), ret );
};
method._promiseRejected =
function SettledPromiseArray$_promiseRejected( reason, index ) {
    if( this._isResolved() ) return;
    var ret = new PromiseInspection( throwawayPromise );
    ret._bitField = 134217728;
    ret._resolvedValue = reason;
    this._promiseResolved( index.valueOf(), ret );
};

return SettledPromiseArray;})();
var AnyPromiseArray = (function() {
function AnyPromiseArray( values, caller ) {
    this.constructor$( values, caller );
}
var method = inherits( AnyPromiseArray, PromiseArray );

method._init = function AnyPromiseArray$_init() {
    this._init$( void 0, null );
};

method._promiseFulfilled =
function AnyPromiseArray$_promiseFulfilled( value ) {
    if( this._isResolved() ) return;
    ++this._totalResolved;
    this._fulfill( value );

};
method._promiseRejected =
function AnyPromiseArray$_promiseRejected( reason, index ) {
    if( this._isResolved() ) return;
    var totalResolved = ++this._totalResolved;
    this._values[ index.valueOf() ] = reason;
    if( totalResolved >= this._length ) {
        this._reject( this._values );
    }

};

return AnyPromiseArray;})();
var SomePromiseArray = (function() {
function SomePromiseArray( values, caller ) {
    this.constructor$( values, caller );
}
var method = inherits( SomePromiseArray, PromiseArray );



method._init = function SomePromiseArray$_init() {
    this._init$( void 0, [] );
    this._howMany = 0;
    this._rejected = 0;
    this._rejectionValues = new Array( this.length() );
    this._resolutionValues = new Array( this.length() );
    if( this._isResolved() ) return;

    if( this._howMany > this._canPossiblyFulfill()  ) {
        this._reject( [] );
    }
};

method._canPossiblyFulfill =
function SomePromiseArray$_canPossiblyFulfill() {
    return this._totalResolved - this._rejected +
        ( this.length() - this._totalResolved );
};

method._promiseFulfilled =
function SomePromiseArray$_promiseFulfilled( value ) {
    if( this._isResolved() ) return;

    var totalResolved = this._totalResolved;
    this._resolutionValues[ totalResolved ] = value;
    this._totalResolved = totalResolved + 1;
    if( totalResolved + 1 === this._howMany ) {
        this._resolutionValues.length = this._howMany;
        this._fulfill( this._resolutionValues );
        this._resolutionValues =
            this._rejectionValues = null;
    }

};
method._promiseRejected =
function SomePromiseArray$_promiseRejected( reason ) {
    if( this._isResolved() ) return;

    this._rejectionValues[ this._rejected ] = reason;
    this._rejected++;
    this._totalResolved++;

    if( this._howMany > this._canPossiblyFulfill() ) {
        this._rejectionValues.length = this._rejected;
        this._reject( this._rejectionValues );
        this._resolutionValues =
            this._rejectionValues = null;
    }
};

return SomePromiseArray;})();
var PromiseInspection = (function() {


function PromiseInspection( promise ) {
    this._bitField = promise._bitField;
    this._resolvedValue = promise.isResolved()
        ? promise._resolvedValue
        : void 0;
}
var method = PromiseInspection.prototype;

method.isFulfilled = function PromiseInspection$isFulfilled() {
    return ( this._bitField & 268435456 ) > 0;
};

method.isRejected = function PromiseInspection$isRejected() {
    return ( this._bitField & 134217728 ) > 0;
};

method.isPending = function PromiseInspection$isPending() {
    return ( this._bitField & 402653184 ) === 0;
};

method.value = function PromiseInspection$value() {
    if( !this.isFulfilled() ) {
        throw new TypeError(
            "cannot get fulfillment value of a non-fulfilled promise");
    }
    return this._resolvedValue;
};

method.error = function PromiseInspection$error() {
    if( !this.isRejected() ) {
        throw new TypeError(
            "cannot get rejection reason of a non-rejected promise");
    }
    return this._resolvedValue;
};




return PromiseInspection;})();

var PromiseResolver = (function() {

var PromiseResolver;
if( !haveGetters ) {
    PromiseResolver = function PromiseResolver( promise ) {
        this.promise = promise;
        this.asCallback = nodebackForResolver( this );
    };
}
else {
    PromiseResolver = function PromiseResolver( promise ) {
        this.promise = promise;
    };
}

var method = PromiseResolver.prototype;

if( haveGetters ) {
    Object.defineProperty( method, "asCallback", {
        get: function() {
            return nodebackForResolver( this );
        }
    });
}

method.toString = function PromiseResolver$toString() {
    return "[object PromiseResolver]";
};

method.fulfill = function PromiseResolver$fulfill( value ) {
    if( this.promise._tryAssumeStateOf( value, false ) ) {
        return;
    }
    this.promise._fulfill(value);
};

method.reject = function PromiseResolver$reject( reason ) {
    this.promise._attachExtraTrace( reason );
    this.promise._reject(reason);
};

method.progress = function PromiseResolver$progress( value ) {
    this.promise._progress(value);
};

method.cancel = function PromiseResolver$cancel() {
    this.promise.cancel((void 0));
};

method.timeout = function PromiseResolver$timeout() {
    this.reject( new TimeoutError( "timeout" ) );
};

method.isResolved = function PromiseResolver$isResolved() {
    return this.promise.isResolved();
};

method.toJSON = function PromiseResolver$toJSON() {
    return this.promise.toJSON();
};


return PromiseResolver;})();
var PromiseSpawn = (function() {

function PromiseSpawn( generatorFunction, receiver, caller ) {
    this._resolver = Promise.pending( caller );
    this._generatorFunction = generatorFunction;
    this._receiver = receiver;
    this._generator = void 0;
}
var method = PromiseSpawn.prototype;

method.promise = function PromiseSpawn$promise() {
    return this._resolver.promise;
};

method._run = function PromiseSpawn$_run() {
    this._generator = this._generatorFunction.call( this._receiver );
    this._receiver =
        this._generatorFunction = void 0;
    this._next( void 0 );
};

method._continue = function PromiseSpawn$_continue( result ) {
    if( result === errorObj ) {
        this._generator = void 0;
        this._resolver.reject( result.e );
        return;
    }

    var value = result.value;
    if( result.done === true ) {
        this._generator = void 0;
        this._resolver.fulfill( value );
    }
    else {
        var ret = Promise._cast( value, PromiseSpawn$_continue );
        if( !( ret instanceof Promise ) ) {
            this._throw( new TypeError(
                "A value was yielded that could not be treated as a promise"
            ) );
            return;
        }
        ret._then(
            this._next,
            this._throw,
            void 0,
            this,
            null,
            void 0
        );
    }
};

method._throw = function PromiseSpawn$_throw( reason ) {
    this.promise()._attachExtraTrace( reason );
    this._continue(
        tryCatch1( this._generator["throw"], this._generator, reason )
    );
};

method._next = function PromiseSpawn$_next( value ) {
    this._continue(
        tryCatch1( this._generator.next, this._generator, value )
    );
};

return PromiseSpawn;})();
if( typeof module !== "undefined" && module.exports ) {
    module.exports = Promise;
}
else if( typeof define === "function" && define.amd ) {
    define( "Promise", [], function(){return Promise;});
}
else {
    global.Promise = Promise;
}


return Promise;})(
    new Function("return this")(),
    Function,
    Array,
    Error,
    Object
);