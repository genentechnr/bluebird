/**
 * Copyright (c) 2013 Petka Antonov
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
"use strict";
module.exports = function( Promise ) {
    var ASSERT = require( "./assert.js");
    var util = require( "./util.js" );
    var async = require( "./async.js" );
    var tryCatch1 = util.tryCatch1;
    var errorObj = util.errorObj;

    Promise.prototype.progressed = function Promise$progressed( fn ) {
        return this._then( void 0, void 0, fn,
                            void 0, void 0, this.progressed );
    };

    Promise.prototype._progress = function Promise$_progress( progressValue ) {
        if( this._isFollowingOrFulfilledOrRejected() ) return;
        this._resolveProgress( progressValue );

    };

    Promise.prototype._progressAt = function Promise$_progressAt( index ) {
        ASSERT(((typeof index) === "number"),
    "typeof index === \u0022number\u0022");
        ASSERT((index >= 0),
    "index >= 0");
        ASSERT(((index % 5) === 0),
    "index % CALLBACK_SIZE === 0");
        if( index === 0 ) return this._progress0;
        return this[ index + 2 - 5 ];
    };

    Promise.prototype._doProgressWith =
    function Promise$_doProgressWith(progression) {
        var progressValue = progression.value;
        var fn = progression.fn;
        var promise = progression.promise;
        var receiver = progression.receiver;

        ASSERT(((typeof fn) === "function"),
    "typeof fn === \u0022function\u0022");
        ASSERT(Promise.is(promise),
    "Promise.is(promise)");

        this._pushContext();
        var ret = tryCatch1(fn, receiver, progressValue);
        this._popContext();

        if( ret === errorObj ) {
            if( ret.e != null &&
                ret.e.name === "StopProgressPropagation" ) {
                ret.e["__promiseHandled__"] = 2;
            }
            else {
                promise._attachExtraTrace( ret.e );
                promise._progress(ret.e);
            }
        }
        else if( Promise.is( ret ) ) {
            ret._then( promise._progress, null, null, promise, void 0,
                this._progress );
        }
        else {
            promise._progress(ret);
        }
    };


    Promise.prototype._resolveProgress =
    function Promise$_resolveProgress( progressValue ) {
        ASSERT(this.isPending(),
    "this.isPending()");
        var len = this._length();

        for( var i = 0; i < len; i += 5 ) {
            var fn = this._progressAt( i );
            var promise = this._promiseAt( i );
            if (!Promise.is(promise)) {
                if (fn !== void 0) {
                    fn.call(this._receiverAt(i), progressValue, promise);
                }
                continue;
            }

            if(fn !== void 0) {
                async.invoke(this._doProgressWith, this, {
                    fn: fn,
                    promise: promise,
                    receiver: this._receiverAt(i),
                    value: progressValue
                });
            }
            else {
                async.invoke(promise._progress, promise, progressValue);
            }
        }
    };
};
