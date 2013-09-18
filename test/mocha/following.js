"use strict";

var assert = require("assert");

var adapter = require("../../js/bluebird_debug.js");
var fulfilled = adapter.fulfilled;
var rejected = adapter.rejected;
var pending = adapter.pending;
var Promise = adapter;

describe("A promise A that is following a promise B", function() {
    specify("Must not react to fulfill/reject/progress that don't come from promise B", function(done) {
        var deferred = Promise.pending();
        var promiseA = deferred.promise;
        var promiseB = Promise.pending().promise;

        promiseA.then(
            assert.fail,
            assert.fail,
            assert.fail
        );
        deferred.fulfill(promiseB);

        deferred.progress(1);
        deferred.fulfill(1);
        deferred.reject(1);
        setTimeout(function(){
            assert.equal( promiseA.isPending(), true );
            assert.equal( promiseB.isPending(), true );
            done();
        }, 30);
    });

    specify("Must not start following another promise C", function(done) {
        var deferred = Promise.pending();
        var promiseA = deferred.promise;
        var promiseB = Promise.pending().promise;
        var deferredC = Promise.pending();
        var promiseC = deferredC.promise;

        promiseA.then(
            assert.fail,
            assert.fail,
            assert.fail
        );
        deferred.fulfill(promiseB);
        deferred.fulfill(promiseC);

        deferredC.progress(1);
        deferredC.fulfill(1);
        deferredC.reject(1);

        promiseC.then(function() {
            assert.equal( promiseA.isPending(), true );
            assert.equal( promiseB.isPending(), true );
            assert.equal( promiseC.isPending(), false );
            done();
        });
    });

    specify("Must react to fulfill/reject/progress that come from promise B", function(done) {
        var deferred = Promise.pending();
        var promiseA = deferred.promise;
        var deferredFollowee = Promise.pending();
        var promiseB = deferredFollowee.promise;

        var c = 0;

        promiseA.then(function(v){
            c++;
            assert.equal(c, 2);
            assert.equal(v, 1);
            done();
        }, assert.fail, function(v){
            c++;
            assert.equal(v, 1);
        });

        deferred.fulfill(promiseB);


        deferredFollowee.progress(1);
        deferredFollowee.fulfill(1);
        deferredFollowee.reject(1);

    });

});