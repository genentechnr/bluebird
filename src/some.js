"use strict";
module.exports = function(Promise, Promise$_All, PromiseArray, apiRejection) {

    var SomePromiseArray = require("./some_promise_array.js")(PromiseArray);
    var ASSERT = require("./assert.js");

    function Promise$_Some(promises, howMany, useBound, caller) {
        if((howMany | 0) !== howMany) {
            return apiRejection("howMany must be an integer");
        }
        var ret = Promise$_All(
            promises,
            SomePromiseArray,
            caller,
            useBound === USE_BOUND ? promises._boundTo : void 0
       );
        var promise = ret.promise();
        if (promise.isRejected()) {
            return promise;
        }
        ASSERT(ret instanceof SomePromiseArray);
        ret.setHowMany(howMany);
        return promise;
    }

    Promise.some = function Promise$Some(promises, howMany) {
        return Promise$_Some(promises, howMany, DONT_USE_BOUND, Promise.some);
    };

    Promise.prototype.some = function Promise$some(count) {
        return Promise$_Some(this, count, USE_BOUND, this.some);
    };

};
