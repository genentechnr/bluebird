var getPromise = require("./get_promise");

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

var ensurePropertyExpansion = function( obj, prop, value ) {
    try {
        notEnumerableProp( obj, prop, value );
        return obj;
    }
    catch( e ) {
        var ret = {};
        var keys = Object.keys( obj );
        for( var i = 0, len = keys.length; i < len; ++i ) {
            try {
                var key = keys[i];
                ret[key] = obj[key];
            }
            catch( err ) {
                ret[key] = err;
            }
        }
        notEnumerableProp( ret, prop, value );
        return ret;
    }
};

var canEvaluate = (function() {
    if( typeof window !== "undefined" && window !== null &&
        typeof window.document !== "undefined" &&
        typeof navigator !== "undefined" && navigator !== null &&
        typeof navigator.appName === "string" &&
        window === global ) {
        return false;
    }
    return true;
})();

function deprecated( msg ) {
    if( typeof console !== "undefined" && console !== null &&
        typeof console.warn === "function" ) {
        console.warn( "Bluebird: " + msg );
    }
}

var isArray = Array.isArray || function( obj ) {
    return obj instanceof Array;
};



var errorObj = {e: {}};
function tryCatch1( fn, receiver, arg ) {
    ASSERT(((typeof fn) === "function"),
    "typeof fn === \u0022function\u0022");
    try {
        return fn.call( receiver, arg );
    }
    catch( e ) {
        errorObj.e = e;
        return errorObj;
    }
}

function tryCatch2( fn, receiver, arg, arg2 ) {
    ASSERT(((typeof fn) === "function"),
    "typeof fn === \u0022function\u0022");
    try {
        return fn.call( receiver, arg, arg2 );
    }
    catch( e ) {
        errorObj.e = e;
        return errorObj;
    }
}

function tryCatchApply( fn, args, receiver ) {
    ASSERT(((typeof fn) === "function"),
    "typeof fn === \u0022function\u0022");
    try {
        return fn.apply( receiver, args );
    }
    catch( e ) {
        errorObj.e = e;
        return errorObj;
    }
}

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

function isObject( value ) {
    return !isPrimitive( value );
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
function makeNodePromisifiedEval( callback, receiver, originalName ) {
    var Promise = getPromise.get();

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

    function getArgs() {
        return "var args = new Array( len + 1 );" +
        "var i = 0;" +
        "for( var i = 0; i < len; ++i ) { " +
        "   args[i] = arguments[i];" +
        "}" +
        "args[i] = fn;";
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
        "default: " + getArgs() + (typeof callback === "string"
            ? "this['" + callback + "'].apply("
            : "callback.apply("
        ) +
            ( receiver === THIS ? "this" : "receiver" ) +
        ", args ); break;" +
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

function makeNodePromisifiedClosure( callback, receiver ) {
    var Promise = getPromise.get();
    function promisified() {
        var _receiver = receiver;
        if( receiver === THIS ) _receiver = this;
        if( typeof callback === "string" ) {
            callback = _receiver[callback];
        }
        ASSERT(((typeof callback) === "function"),
    "typeof callback === \u0022function\u0022");
        var resolver = Promise.pending( promisified );
        var fn = nodebackForResolver( resolver );
        try {
            callback.apply( _receiver, withAppended( arguments, fn ) );
        }
        catch(e) {
            resolver.reject( maybeWrapAsError( e ) );
        }
        return resolver.promise;
    }
    promisified.__isPromisified__ = true;
    return promisified;
}

var makeNodePromisified = canEvaluate
    ? makeNodePromisifiedEval
    : makeNodePromisifiedClosure;


module.exports ={
    isArray: isArray,
    makeNodePromisified: makeNodePromisified,
    haveGetters: haveGetters,
    THIS: THIS,
    notEnumerableProp: notEnumerableProp,
    isPrimitive: isPrimitive,
    isObject: isObject,
    ensurePropertyExpansion: ensurePropertyExpansion,
    canEvaluate: canEvaluate,
    deprecated: deprecated,
    errorObj: errorObj,
    tryCatch1: tryCatch1,
    tryCatch2: tryCatch2,
    tryCatchApply: tryCatchApply,
    inherits: inherits,
    withAppended: withAppended,
    asString: asString,
    maybeWrapAsError: maybeWrapAsError,
    nodebackForResolver: nodebackForResolver
};
