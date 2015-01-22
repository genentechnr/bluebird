"use strict";

var assert = require("assert");
var testUtils = require("./helpers/util.js");


function promised(val) {
    return new Promise(function(f) {
        setTimeout(function() {
            f(val);
        }, 4);
    });
}

function thenabled(val, arr) {
    return {
        then: function(f){
            setTimeout(function() {
                if (arr) arr.push(val);
                f(val);
            }, 4);
        }
    };
}

describe("Promise.each", function() {

    it("should return the array's values", function() {
        var a = [promised(1), promised(2), promised(3)];
        var b = [];
        return Promise.resolve(a).each(function(val) {
            b.push(3-val);
            return val;
        }).then(function(ret) {
            assert.deepEqual(ret, [1,2,3]);
            assert.deepEqual(b, [2, 1, 0]);
        });
    });


    it("takes value, index and length", function() {
        var a = [promised(1), promised(2), promised(3)];
        var b = [];
        return Promise.resolve(a).each(function(value, index, length) {
            b.push(value, index, length);
        }).then(function(ret) {
            assert.deepEqual(b, [1, 0, 3, 2, 1, 3, 3, 2, 3]);
        });
    });

    it("waits for returned promise before proceeding next", function() {
        var a = [promised(1), promised(2), promised(3)];
        var b = [];
        return Promise.resolve(a).each(function(value) {
            b.push(value);
            return Promise.delay(10).then(function(){
                b.push(value*2);
            });
        }).then(function(ret) {
            assert.deepEqual(b, [1,2,2,4,3,6]);
        });
    });

    it("waits for returned thenable before proceeding next", function() {
        var b = [1, 2, 3];
        var a = [thenabled(1), thenabled(2), thenabled(3)];
        return Promise.resolve(a).each(function(val) {
            b.push(val * 50);
            return thenabled(val * 500, b);
        }).then(function(ret) {
            assert.deepEqual(b, [1, 2, 3, 50, 500, 100, 1000, 150, 1500]);
        });
    });

    it("doesnt iterate with an empty array", function() {
        return Promise.each([], function(val) {
            throw new Error();
        }).then(function(ret) {
            assert.deepEqual(ret, []);
        });
    });

    it("iterates with an array of single item", function() {
        var b = [];
        return Promise.each([promised(1)], function(val) {
            b.push(val);
            return thenabled(val*2, b);
        }).then(function(ret) {
            assert.deepEqual(b, [1,2]);
        });
    });
});

describe("Promise.prototype.each", function() {

    it("should return the array's values", function() {
        var a = [promised(1), promised(2), promised(3)];
        var b = [];
        return Promise.resolve(a).each(function(val) {
            b.push(3-val);
            return val;
        }).then(function(ret) {
            assert.deepEqual(ret, [1,2,3]);
            assert.deepEqual(b, [2, 1, 0]);
        });
    });


    it("takes value, index and length", function() {
        var a = [promised(1), promised(2), promised(3)];
        var b = [];
        return Promise.resolve(a).each(function(value, index, length) {
            b.push(value, index, length);
        }).then(function(ret) {
            assert.deepEqual(b, [1, 0, 3, 2, 1, 3, 3, 2, 3]);
        });
    });

    it("waits for returned promise before proceeding next", function() {
        var a = [promised(1), promised(2), promised(3)];
        var b = [];
        return Promise.resolve(a).each(function(value) {
            b.push(value);
            return Promise.delay(10).then(function(){
                b.push(value*2);
            });
        }).then(function(ret) {
            assert.deepEqual(b, [1,2,2,4,3,6]);
        });
    });

    it("waits for returned thenable before proceeding next", function() {
        var b = [1, 2, 3];
        var a = [thenabled(1), thenabled(2), thenabled(3)];
        return Promise.resolve(a).each(function(val) {
            b.push(val * 50);
            return thenabled(val * 500, b);
        }).then(function(ret) {
            assert.deepEqual(b, [1, 2, 3, 50, 500, 100, 1000, 150, 1500]);
        });
    });

    it("doesnt iterate with an empty array", function() {
        return Promise.resolve([]).each(function(val) {
            throw new Error();
        }).then(function(ret) {
            assert.deepEqual(ret, []);
        });
    });

    it("iterates with an array of single item", function() {
        var b = [];
        return Promise.resolve([promised(1)]).each(function(val) {
            b.push(val);
            return thenabled(val*2, b);
        }).then(function(ret) {
            assert.deepEqual(b, [1,2]);
        });
    });
});
