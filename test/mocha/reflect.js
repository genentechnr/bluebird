"use strict";

var assert = require("assert");
var Promise = require("../../js/debug/bluebird.js");
var testFulfilled = require("./helpers/testThreeCases").testFulfilled;
var testRejected = require("./helpers/testThreeCases").testRejected;



describe(".reflect()", function() {
    testFulfilled(1, function(promise, done) {
        promise.reflect().then(function(inspection) {
            assert(inspection instanceof Promise.PromiseInspection);
            assert(inspection.isFulfilled());
            assert(inspection.value() === 1);
            done();
        });
    });
    testRejected(2, function(promise, done) {
        promise.reflect().then(function(inspection) {
            assert(inspection instanceof Promise.PromiseInspection);
            assert(inspection.isRejected());
            assert(inspection.reason() === 2);
            done();
        });
    });
});
