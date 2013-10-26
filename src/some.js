module.exports = function( Promise, Promise$_All ) {
    var errors = require( "./errors.js" );
    var apiRejection = errors.apiRejection;
    var SomePromiseArray = require( "./some_promise_array.js" );
    var ASSERT = require( "./assert.js" );

    function Promise$_Some( promises, howMany, useBound, caller ) {
        if( ( howMany | 0 ) !== howMany ) {
            return apiRejection("howMany must be an integer");
        }
        var ret = Promise$_All(
            promises,
            SomePromiseArray,
            caller,
            useBound === USE_BOUND ? promises._boundTo : void 0
        );
        ASSERT( ret instanceof SomePromiseArray );
        ret.setHowMany( howMany );
        return ret.promise();
    }

    Promise.some = function Promise$Some( promises, howMany ) {
        return Promise$_Some( promises, howMany, DONT_USE_BOUND, Promise.some );
    };

    Promise.prototype.some = function Promise$some( count ) {
        return Promise$_Some( this, count, USE_BOUND, this.some );
    };
};

