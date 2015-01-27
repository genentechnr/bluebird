"use strict";

var assert = require("assert");
var testUtils = require("./helpers/util.js");

var OperationalError = Promise.OperationalError;

var erroneusNode = function(a, b, c, cb) {
    setTimeout(function(){
        cb(sentinelError);
    }, 1);
};

var sentinel = {};
var sentinelError = new OperationalError();

var successNode = function(a, b, c, cb) {
    setTimeout(function(){
        cb(null, sentinel);
    }, 1);
};

var successNodeMultipleValues = function(a, b, c, cb) {
    setTimeout(function(){
        cb(null, sentinel, sentinel, sentinel);
    }, 1);
};

var syncErroneusNode = function(a, b, c, cb) {
    cb(sentinelError);
};

var syncSuccessNode = function(a, b, c, cb) {
    cb(null, sentinel);
};

var syncSuccessNodeMultipleValues = function(a, b, c, cb) {
    cb(null, sentinel, sentinel, sentinel);
};

var errToThrow;
var thrower = Promise.promisify(function(a, b, c, cb) {
    errToThrow = new OperationalError();
    throw errToThrow;
});

var tprimitive = "Where is your stack now?";
var throwsStrings = Promise.promisify(function(cb){
    throw tprimitive;
});

var errbacksStrings = Promise.promisify(function(cb){
    cb(tprimitive);
});

var errbacksStringsAsync = Promise.promisify(function(cb){
    setTimeout(function(){
        cb(tprimitive);
    }, 1);
});

var error = Promise.promisify(erroneusNode);
var success = Promise.promisify(successNode);
var successMulti = Promise.promisify(successNodeMultipleValues);
var syncError = Promise.promisify(syncErroneusNode);
var syncSuccess = Promise.promisify(syncSuccessNode);
var syncSuccessMulti = Promise.promisify(syncSuccessNodeMultipleValues);

describe("when calling promisified function it should ", function(){


    specify("return a promise that is pending", function() {
        var a = error(1,2,3);
        var b = success(1,2,3);
        var c = successMulti(1,2,3);

        var calls = 0;

        assert.equal(a.isPending(), true);
        assert.equal(b.isPending(), true);
        assert.equal(c.isPending(), true);
        return a.caught(testUtils.noop);
    });

    specify("should use this if no receiver was given", function(){
        var o = {};
        var fn = Promise.promisify(function(cb){

            cb(null, this === o);
        });

        o.fn = fn;

        return o.fn().then(function(val){
            assert(val);
        });
    });

    specify("do nothing when called more than 1 times", function() {
        var err = new Error();
        var stack = err.stack;

        var fn = Promise.promisify(function(cb) {
            cb(null);
            cb(err);
        });

        return fn().then(function() {
            return Promise.delay(1).then(function() {
                assert.strictEqual(stack, err.stack);
            })
        });
    });

    specify("undefined as receiver", function() {
        return Promise.promisify(function(cb) {
            assert.strictEqual(this, (function(){return this;})());
            cb(null, 1);
        }, undefined)().then(function(result) {
            assert.strictEqual(1, result);
        });
    });

    specify("double promisification returns same function back", function() {
        var c = function(){};
        var a = Promise.promisify(function(){});
        var b = Promise.promisify(a);
        assert.notEqual(c, a);
        assert.strictEqual(a, b);
    });

    specify("call future attached handlers later", function() {
        var a = error(1,2,3).then(0, testUtils.noop);
        var b = success(1,2,3);
        var c = successMulti(1,2,3);
        var d = syncError(1,2,3).then(0, testUtils.noop);
        var e = syncSuccess(1,2,3).then(0, testUtils.noop);
        var f = syncSuccessMulti(1,2,3).then(0, testUtils.noop);
        var calls = 0;
        return Promise.all([a, b, c, d, e, f]);
    });

    specify("Reject with the synchronously caught reason", function(){
        thrower(1, 2, 3).then(assert.fail).then(assert.fail, function(e){
            assert(e === errToThrow);
        });
    });

    specify("reject with the proper reason", function() {
        var a = error(1,2,3);
        var b = syncError(1,2,3);

        return Promise.all([
            a.then(assert.fail, function(e){
                assert.equal(sentinelError, e);
            }),
            b.then(assert.fail, function(e){
                assert.equal(sentinelError, e);
            })
        ]);
    });

    specify("fulfill with proper value(s)", function() {
        var a = success(1,2,3);
        var b = successMulti(1,2,3);
        var c = syncSuccess(1,2,3);
        var d = syncSuccessMulti(1,2,3);

        return Promise.all([

            a.then(function(val){
                assert.equal(val, sentinel);
            }),

            b.then(function(val){
                assert.deepEqual(val, [sentinel, sentinel, sentinel]);
            }),

            c.then(function(val){
                assert.equal(val, sentinel);
            }),

            d.then(function(val){
                assert.deepEqual(val, [sentinel, sentinel, sentinel]);
            })

        ]);
    });


});


describe("with more than 5 arguments", function(){

    var o = {
        value: 15,

        f: function(a,b,c,d,e,f,g, cb) {
            cb(null, [a,b,c,d,e,f,g, this.value])
        }

    }

    var prom = Promise.promisify(o.f, o);

    specify("receiver should still work", function() {
        return prom(1,2,3,4,5,6,7).then(function(val){
            assert.deepEqual(
                val,
                [1,2,3,4,5,6,7, 15]
            );
        });

    });

});

describe("promisify on objects", function(){

    var o = {
        value: 15,

        f: function(a,b,c,d,e,f,g, cb) {
            cb(null, [a,b,c,d,e,f,g, this.value])
        }

    };

    var objf = function(){};

    objf.value = 15;
    objf.f = function(a,b,c,d,e,f,g, cb) {
        cb(null, [a,b,c,d,e,f,g, this.value])
    };

    function Test(data) {
        this.data = data;
    }

    Test.prototype.get = function(a, b, c, cb) {
        cb(null, a, b, c, this.data);
    };

    Test.prototype.getMany = function(a, b, c, d, e, f, g, cb) {
        cb(null, a, b, c, d, e, f, g, this.data);
    };

    Promise.promisifyAll(o);
    Promise.promisifyAll(objf);
    Promise.promisifyAll(Test.prototype);

    specify("should not repromisify", function() {
        var f = o.f;
        var fAsync = o.fAsync;
        var getOwnPropertyNames = Object.getOwnPropertyNames(o);
        var ret = Promise.promisifyAll(o);
        assert.equal(f, o.f);
        assert.equal(fAsync, o.fAsync);
        assert.deepEqual(getOwnPropertyNames, Object.getOwnPropertyNames(o));
        assert.equal(ret, o);
    });

    specify("should not repromisify function object", function() {
        var f = objf.f;
        var fAsync = objf.fAsync;
        var getOwnPropertyNames = Object.getOwnPropertyNames(objf);
        var ret = Promise.promisifyAll(objf);
        assert.equal(f, objf.f);
        assert.equal(fAsync, objf.fAsync);
        assert.deepEqual(getOwnPropertyNames, Object.getOwnPropertyNames(objf));
        assert.equal(ret, objf);
    });

    specify("should work on function objects too", function() {
        objf.fAsync(1, 2, 3, 4, 5, 6, 7).then(function(result){
            assert.deepEqual(result, [1, 2, 3, 4, 5, 6, 7, 15]);
        });
    });

    specify("should work on prototypes and not mix-up the instances", function() {
        var a = new Test(15);
        var b = new Test(30);
        var c = new Test(45);

        return Promise.all([
            a.getAsync(1, 2, 3).then(function(result){
                assert.deepEqual(result, [1, 2, 3, 15]);
            }),

            b.getAsync(4, 5, 6).then(function(result){
                assert.deepEqual(result, [4, 5, 6, 30]);
            }),

            c.getAsync(7, 8, 9).then(function(result){
                assert.deepEqual(result, [7, 8, 9, 45]);
            })
        ]);
    });

    specify("should work on prototypes and not mix-up the instances with more than 5 arguments", function() {
        var a = new Test(15);
        var b = new Test(30);
        var c = new Test(45);

        return Promise.all([
            a.getManyAsync(1, 2, 3, 4, 5, 6, 7).then(function(result){
                assert.deepEqual(result, [1, 2, 3, 4, 5, 6, 7, 15]);
            }),

            b.getManyAsync(4, 5, 6, 7, 8, 9, 10).then(function(result){
                assert.deepEqual(result, [4, 5, 6, 7, 8, 9, 10, 30]);
            }),

            c.getManyAsync(7, 8, 9, 10, 11, 12, 13).then(function(result){
                assert.deepEqual(result, [7, 8, 9, 10, 11, 12, 13, 45]);
            })
        ]);
    });

    specify("Fails to promisify Async suffixed methods", function() {
        var o = {
            x: function(cb){
                cb(null, 13);
            },
            xAsync: function(cb) {
                cb(null, 13);
            },

            xAsyncAsync: function(cb) {
                cb(null, 13)
            }
        };
        try {
            Promise.promisifyAll(o);
        }
        catch (e) {
            assert(e instanceof Promise.TypeError);
        }
    });

    specify("Calls overridden methods", function() {
        function Model() {
            this.save = function() {};
        }
        Model.prototype.save = function() {
            throw new Error("");
        };

        Promise.promisifyAll(Model.prototype);
        var model = new Model();
        model.saveAsync();
    });

    specify("gh-232", function() {
        function f() {
            var args = [].slice.call(arguments, 0, -1);
            assert.deepEqual(args, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
            var cb = [].slice.call(arguments, -1)[0];
            cb(null, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10);
        }
        var fAsync = Promise.promisify(f);
        return fAsync(1, 2, 3, 4, 5, 6, 7, 8, 9, 10).then(function(result) {
            assert.deepEqual(result, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        });
    });


    specify("gh335", function() {
        function HasArgs() { }
        HasArgs.prototype.args = function(cb) {
            return cb(null, "ok");
        };

        Promise.promisifyAll(HasArgs.prototype);
        var a = new HasArgs();
        return a.argsAsync().then(function(res) {
            assert.equal(res, "ok");
        });
    });

});

describe("Promisify with custom suffix", function() {
    it("should define methods with the custom suffix", function() {
        function Test() {

        }

        Test.prototype.method = function method() {};

        Promise.promisifyAll(Test.prototype, {suffix: "$P"});
        assert(typeof Test.prototype.method$P == "function");
    });

    it("should throw on invalid suffix", function() {
        try {
            Promise.promisifyAll({}, {suffix: ""});
        }
        catch (e) {
            return;
        }
        assert.fail();
    });
})

describe("Module promisification", function() {
    it("should promisify module with direct property classes", function() {
        function RedisClient() {}
        RedisClient.prototype.query = function() {};
        function Multi() {}
        Multi.prototype.exec = function() {};
        Multi.staticMethod = function() {}

        var redis = {
            RedisClient: RedisClient,
            Multi: Multi,
            moduleMethod: function() {}
        };
        redis.Multi.staticMethod.tooDeep = function() {};

        Promise.promisifyAll(redis);

        assert(typeof redis.moduleMethodAsync === "function");
        assert(typeof redis.Multi.staticMethodAsync === "function");
        assert(typeof redis.Multi.prototype.execAsync === "function");
        assert(typeof redis.RedisClient.prototype.queryAsync === "function");
        assert(typeof redis.Multi.staticMethod.tooDeepAsync === "undefined");
    })

    it("should promisify module with inherited property classes", function() {
        function Mongoose() {}
        var Model = Mongoose.prototype.Model = function() {};
        Model.prototype.find = function() {};
        var Document = Mongoose.prototype.Document = function() {};
        Document.prototype.create = function() {};
        Document.staticMethod = function() {};
        var mongoose = new Mongoose();

        Promise.promisifyAll(mongoose);

        assert(typeof mongoose.Model.prototype.findAsync === "function");
        assert(typeof mongoose.Document.prototype.createAsync === "function");
        assert(typeof mongoose.Document.staticMethodAsync === "function")
    })
})

describe("Promisify from prototype to object", function() {
    var getterCalled = 0;

    function makeClass() {
        var Test = (function() {

        function Test() {

        }
        var method = Test.prototype;

        method.test = function() {

        };

        method["---invalid---"] = function(){};

        if ((function(){"use strict"; return this === void 0})()) {
            Object.defineProperty(method, "thrower", {
                enumerable: true,
                configurable: true,
                get: function() {
                    throw new Error("getter called");
                },
                set: function() {
                    throw new Error("setter called");
                }
            });
            Object.defineProperty(method, "counter", {
                enumerable: true,
                configurable: true,
                get: function() {
                    getterCalled++;
                },
                set: function() {
                    throw new Error("setter called");
                }
            });
        }

        return Test;})();

        return Test;
    }

    specify("Shouldn't touch the prototype when promisifying instance", function() {
        var Test = makeClass();

        var origKeys = Object.getOwnPropertyNames(Test.prototype).sort();
        var a = new Test();
        Promise.promisifyAll(a);

        assert(typeof a.testAsync === "function");
        assert(a.hasOwnProperty("testAsync"));
        assert.deepEqual(Object.getOwnPropertyNames(Test.prototype).sort(), origKeys);
        assert(getterCalled === 0);
    });

    specify("Shouldn't touch the method", function() {
        var Test = makeClass();

        var origKeys = Object.getOwnPropertyNames(Test.prototype.test).sort();
        var a = new Test();
        Promise.promisifyAll(a);


        assert(typeof a.testAsync === "function");
        assert.deepEqual(Object.getOwnPropertyNames(Test.prototype.test).sort(), origKeys);
        assert(Promise.promisify(a.test) !== a.testAsync);
        assert(getterCalled === 0);
    });

    specify("Should promisify own method even if a promisified method of same name already exists somewhere in proto chain", function(){
        var Test = makeClass();
        var instance = new Test();
        Promise.promisifyAll(instance);
        var origKeys = Object.getOwnPropertyNames(Test.prototype).sort();
        var origInstanceKeys = Object.getOwnPropertyNames(instance).sort();
        instance.test = function() {};
        Promise.promisifyAll(instance);
        assert.deepEqual(origKeys, Object.getOwnPropertyNames(Test.prototype).sort());
        assert.notDeepEqual(origInstanceKeys,  Object.getOwnPropertyNames(instance).sort());
        assert(getterCalled === 0);
    });

    specify("Shouldn promisify the method closest to the object if method of same name already exists somewhere in proto chain", function(){
        //IF the implementation is for-in, this pretty much tests spec compliance
        var Test = makeClass();
        var origKeys = Object.getOwnPropertyNames(Test.prototype).sort();
        var instance = new Test();
        instance.test = function() {};
        Promise.promisifyAll(instance);

        assert.deepEqual(Object.getOwnPropertyNames(Test.prototype).sort(), origKeys);
        assert(instance.test === instance.test);
        assert(getterCalled === 0);
    });

});


function assertLongStackTraces(e) {
    assert(e.stack.indexOf("From previous event:") > -1);
}
if (Promise.hasLongStackTraces()) {
    describe("Primitive errors wrapping", function() {
        specify("when the node function throws it", function(){
            return throwsStrings().then(assert.fail, function(e){
                assert(e instanceof Error);
                assert(e.message == tprimitive);
            });
        });

        specify("when the node function throws it inside then", function(){
            return Promise.resolve().then(function() {
                throwsStrings().then(assert.fail, function(e) {
                    assert(e instanceof Error);
                    assert(e.message == tprimitive);
                    assertLongStackTraces(e);
                });
            });
        });


        specify("when the node function errbacks it synchronously", function(){
            return errbacksStrings().then(assert.fail, function(e){
                assert(e instanceof Error);
                assert(e.message == tprimitive);
            });
        });

        specify("when the node function errbacks it synchronously inside then", function(){
            return Promise.resolve().then(function(){
                errbacksStrings().then(assert.fail, function(e){
                    assert(e instanceof Error);
                    assert(e.message == tprimitive);
                    assertLongStackTraces(e);
                });
            });
        });

        specify("when the node function errbacks it asynchronously", function(){
            return errbacksStringsAsync().then(assert.fail, function(e){
                assert(e instanceof Error);
                assert(e.message == tprimitive);
                assertLongStackTraces(e);
            });
        });

        specify("when the node function errbacks it asynchronously inside then", function(){
            return Promise.resolve().then(function(){
                errbacksStringsAsync().then(assert.fail, function(e){
                    assert(e instanceof Error);
                    assert(e.message == tprimitive);
                    assertLongStackTraces(e);
                });
            });
        });
    });
}

describe("Custom promisifier", function() {
    var dummy = {};
    var err = new Error();
    var chrome = {
        getTab: function(tabId, callback) {
            setTimeout(function() {
                callback(dummy);
            }, 1);
        },
        getTabErroneous: function(tabId, callback, errback) {
            setTimeout(function() {
                errback(err);
            }, 1);
        }
    };

    Promise.promisifyAll(chrome, {
        promisifier: function(originalMethod) {
            return function() {
                var self = this;
                var args = [].slice.call(arguments);
                return new Promise(function(f, r) {
                    args.push(f, r);
                    originalMethod.apply(self, args);
                });
            };
        }
    });

    specify("getTab", function() {
        return chrome.getTabAsync(1).then(function(result) {
            assert.equal(dummy, result);
        });
    });

    specify("getTabErroneous", function() {
        return chrome.getTabErroneousAsync(2).then(assert.fail, function(e) {
            assert.equal(e, err);
        });
    });

    specify("custom promisifier enhancing default promisification", function() {
        var obj = {
            a: function(cb) {
                setTimeout(function() {
                    cb(null, 1);
                }, 1);
            },

            b: function(val, cb) {
                setTimeout(function() {
                    cb(null, val);
                }, 1);
            }
        };
        obj = Promise.promisifyAll(obj, {
            promisifier: function(originalFunction, defaultPromisifier) {
                var promisified = defaultPromisifier(originalFunction);

                return function() {
                    var args = [].slice.call(arguments);
                    var self = this;
                    return Promise.all(args).then(function(awaitedArgs) {
                        return promisified.apply(self, awaitedArgs);
                    });
                };
            }
        });

        return obj.bAsync(obj.aAsync()).then(function(val) {
            assert.strictEqual(val, 1);
        });

    });


});

describe("OperationalError wrapping", function() {

    var CustomError = function(){

    }
    CustomError.prototype = new Error();
    CustomError.prototype.constructor = CustomError;

    function isUntypedError(obj) {
        return obj instanceof Error &&
            Object.getPrototypeOf(obj) === Error.prototype;
    }


    if (!isUntypedError(new Error())) {
        console.log("error must be untyped");
    }

    if (isUntypedError(new CustomError())) {
        console.log("customerror must be typed");
    }

    function stringback(cb) {
        cb("Primitive as error");
    }

    function errback(cb) {
        cb(new Error("error as error"));
    }

    function typeback(cb) {
        cb(new CustomError());
    }

    function stringthrow(cb) {
        throw("Primitive as error");
    }

    function errthrow(cb) {
        throw(new Error("error as error"));
    }

    function typethrow(cb) {
        throw(new CustomError());
    }

    stringback = Promise.promisify(stringback);
    errback = Promise.promisify(errback);
    typeback = Promise.promisify(typeback);
    stringthrow = Promise.promisify(stringthrow);
    errthrow = Promise.promisify(errthrow);
    typethrow = Promise.promisify(typethrow);

    specify("should wrap stringback", function() {
        return stringback().error(function(e) {
            assert(e instanceof OperationalError);
        });
    });

    specify("should wrap errback", function() {
        return errback().error(function(e) {
            assert(e instanceof OperationalError);
        });
    });

    specify("should not wrap typeback", function() {
        return typeback().caught(CustomError, function(e){
            });
    });

    specify("should not wrap stringthrow", function() {
        return stringthrow().error(assert.fail).then(assert.fail, function(e){
            assert(e instanceof Error);
        });
    });

    specify("should not wrap errthrow", function() {
        return errthrow().error(assert.fail).then(assert.fail, function(e) {
            assert(e instanceof Error);
        });
    });

    specify("should not wrap typethrow", function() {
        return typethrow().error(assert.fail)
            .caught(CustomError, function(e){
            });
    });
});

var global = new Function("return this")();
var canEvaluate = (function() {
    if (typeof window !== "undefined" && window !== null &&
        typeof window.document !== "undefined" &&
        typeof navigator !== "undefined" && navigator !== null &&
        typeof navigator.appName === "string" &&
        window === global) {
        return false;
    }
    return true;
})();
var canTestArity = (function(a, b, c) {}).length === 3 && canEvaluate;

if (canTestArity) {
    describe("arity", function() {
        specify("should be original - 1", function() {
            var fn = function(a, b, c, callback) {};

            assert.equal(Promise.promisify(fn).length, 3);

            var o = {
                fn: function(a, b, c, callback) {

                }
            };
            assert.equal(Promise.promisifyAll(o).fnAsync.length, 3);
        })
    })
}

describe("nodeback with multiple arguments", function() {
    specify("spreaded with immediate values", function() {
        var promise = Promise.promisify(function(cb) {
            cb(null, 1, 2, 3);
        })();

        return promise.spread(function(a, b, c) {
            assert.equal(a, 1);
            assert.equal(b, 2);
            assert.equal(c, 3);
        });
    });

    specify("spreaded with thenable values should not be unwrapped", function() {
        var a = {then: function(){}};
        var b = a;
        var c = a;
        var promise = Promise.promisify(function(cb) {
            cb(null, a, b, c);
        })();

        return promise.spread(function(a_, b_, c_) {
            assert.equal(a_, a);
            assert.equal(b_, b);
            assert.equal(c_, c);
        });
    });

    specify("spreaded with promise values should not be unwrapped", function() {
        var a = Promise.resolve(1);
        var b = Promise.resolve(2);
        var c = Promise.resolve(3);
        var promise = Promise.promisify(function(cb) {
            cb(null, a, b, c);
        })();

        return promise.spread(function(a_, b_, c_) {
            assert.strictEqual(a_, a);
            assert.strictEqual(b_, b);
            assert.strictEqual(c_, c);
        });
    });
});

describe("filter", function() {
    specify("gets an argument whether default filter was passed", function() {
        Promise.promisifyAll({
            abc: function() {}
        }, {
            filter: function(_, __, ___, passesDefaultFilter) {
                assert.strictEqual(passesDefaultFilter, true);
            }
        })
    });

    specify("doesn't fail when allowing non-identifier methods", function() {
        var a = Promise.promisifyAll({
            " a s d ": function(cb) {
                cb(null, 1);
            }
        }, {
            filter: function() {
                return true;
            }
        });

        a[" a s d Async"]().then(function(val) {
            assert.strictEqual(1, val);
        });
    });
});
