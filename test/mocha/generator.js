"use strict";

var assert = require("assert");

var adapter = require("../../js/bluebird_debug.js");
var fulfilled = adapter.fulfilled;
var rejected = adapter.rejected;
var pending = adapter.pending;
var Promise = adapter;

function get(arg) {
    return {
        then: function(ful, rej) {
            ful(arg)
        }
    }
}

function fail(arg) {
    return {
        then: function(ful, rej) {
            rej(arg)
        }
    };
}

function delay() {
    return new Promise(function(a){
        setTimeout(a, 15);
    });
}

var error = new Error("asd");

describe("thenables", function(){

    specify("when they fulfill, the yielded value should be that fulfilled value", function(done){

        Promise.spawn(function*(){

            var a = yield get(3);
            assert.equal(a, 3);
            return 4;

        }).then(function(arg){
            assert.equal(arg, 4);
            done();
        });

    });


    specify("when they reject, and the generator doesn't have try catch, it should immediately reject the promise", function(done){

        Promise.spawn(function*(){
            var a = yield fail(error);
            assert.fail();

        }).then(assert.fail).catch(function(e){
            assert.equal(e, error);
            done();
        });

    });

    specify("when they reject, and the generator has try catch, it should continue working normally", function(done){

        Promise.spawn(function*(){
            try {
                var a = yield fail(error);
            }
            catch(e) {
                return e;
            }
            assert.fail();

        }).then(function(v){
            assert.equal(v, error);
            done();
        });

    });

    specify("when they fulfill but then throw, it should become rejection", function(done){

        Promise.spawn(function*(){
            var a = yield get(3);
            assert.equal(a, 3);
            throw error;
        }).then(assert.fail).catch(function(e){
            assert.equal(e, error);
            done();
        });
    });
});

describe("delayed promises", function(){

    specify("should delay sync looking execution", function(done){
        Promise.spawn(function* () {
            var now = Date.now();
            yield delay();
            yield delay();
            yield delay();
            yield delay();
            yield delay();
            yield delay();
            return Date.now() - now;
        }).then(function(val){
            assert(val > 50);
            done();
        });
    });

});

describe("yield loop", function(){

    specify("should work", function(done){
        Promise.spawn(function* () {
            var a = [1,2,3,4,5];

            for( var i = 0, len = a.length; i < len; ++i ) {
                a[i] = yield get(a[i] * 2);
            }

            return a;
        }).then(function(arr){
            assert.deepEqual([2,4,6,8,10], arr);
            done();
        });
    });

    specify("inside yield should work", function(done){
        Promise.spawn(function *() {
            var a = [1,2,3,4,5];

            return yield Promise.all(a.map(function(v){
                return Promise.spawn(function *() {
                    return yield get(v*2);
                });
            }));
        }).then(function(arr){
            assert.deepEqual([2,4,6,8,10], arr);
            done();
        });
    });

    specify("with simple map should work", function(done){
        Promise.spawn(function *() {
            var a = [1,2,3,4,5];

            return yield Promise.map(a, function(v){
                return Promise.cast(get(v*2));
            });
        }).then(function(arr){
            assert.deepEqual([2,4,6,8,10], arr);
            done();
        });
    });

});