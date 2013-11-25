//This is pretty lame but what you gonna do

//async.js
CONSTANT(BUFFER_STRIDE, 3);

//errors.js
CONSTANT(ERROR_HANDLED_KEY, "__promiseHandled__");
CONSTANT(DEFAULT_STATE, 0);
CONSTANT(STACK_ATTACHED, 1);
CONSTANT(ERROR_HANDLED, 2);

//promise.js
CONSTANT(USE_BOUND, true);
CONSTANT(DONT_USE_BOUND, false);
CONSTANT(MUST_ASYNC, true);
CONSTANT(MAY_SYNC, false);

CONSTANT(CALLBACK_FULFILL_OFFSET, 0);
CONSTANT(CALLBACK_REJECT_OFFSET, 1);
CONSTANT(CALLBACK_PROGRESS_OFFSET, 2);
CONSTANT(CALLBACK_PROMISE_OFFSET, 3);
CONSTANT(CALLBACK_RECEIVER_OFFSET, 4);
CONSTANT(CALLBACK_SIZE, 5);
//Layout for .bitField
//RRWF NCTR LLLL LLLL LLLL LLLL LLLL LLLL
//W = isFollowing (The promise that is being followed is not stored explicitly)
//F = isFulfilled
//N = isRejected
//C = isCancellable
//T = isFinal (used for .done() implementation)

//R = [Reserved]
//L = Length, 24 bit unsigned
CONSTANT(IS_FOLLOWING, 0x20000000|0);
CONSTANT(IS_FULFILLED, 0x10000000|0);
CONSTANT(IS_REJECTED, 0x8000000|0);
CONSTANT(IS_CANCELLABLE, 0x4000000|0);
CONSTANT(IS_FINAL, 0x2000000|0);
CONSTANT(LENGTH_MASK, 0xFFFFFF|0);
CONSTANT(LENGTH_CLEAR_MASK, ~LENGTH_MASK);
CONSTANT(MAX_LENGTH, LENGTH_MASK);
CONSTANT(IS_REJECTED_OR_FULFILLED, IS_REJECTED | IS_FULFILLED);
CONSTANT(IS_FOLLOWING_OR_REJECTED_OR_FULFILLED, IS_REJECTED_OR_FULFILLED | IS_FOLLOWING);

CONSTANT(BEFORE_PROMISIFIED_SUFFIX, "__beforePromisified__");
CONSTANT(AFTER_PROMISIFIED_SUFFIX, "Async");

//promise_array.js
CONSTANT(RESOLVE_UNDEFINED, 0);
CONSTANT(RESOLVE_ARRAY, 1);
CONSTANT(RESOLVE_OBJECT, 2);
CONSTANT(RESOLVE_FOREVER_PENDING, 3);

//queue.js
CONSTANT(QUEUE_MAX_CAPACITY, (1 << 30) | 0);
CONSTANT(QUEUE_MIN_CAPACITY, 16);


//captured_trace.js
CONSTANT(FROM_PREVIOUS_EVENT, "From previous event:");

//direct_resolve.js
CONSTANT(THROW, 1);
CONSTANT(RETURN, 2);
