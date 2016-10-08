(function(){

	var root = this;

	var previousUnderscore = root._;

	var ArrayProto = Array.prototype,
	    ObjProto = Object.prototype,
	    FuncProto = Function.prototype;

	var 
	    push = ArrayProto.push,
	    slice = ArrayProto.slice,
	    toString = ObjProto.toString,
	    hasOwnProperty = ObjProto.hasOwnProperty;

	var
	    nativeIsArray = Array.isArray,
	    nativeKeys = Object.keys,
	    nativeBind = FuncProto.bind,
	    nativeCreate = Object.create;

	var Ctor = function(){};

	var _ = function(obj) {
		if (obj instanceof _) return obj;
		if (!(this instanceof _)) return new_(obj);
		this._wrapped = obj;
	};

	if (typeof exports !== 'undefined') {
		if (typeof module !== 'undefined' && module.exports) {
			exports = module.exports = _;
		}
		exports._ = _;
	} else {
		root._ = _;
	}

	_.VERSION = '1.8.3';

	var optimizeCb = function(func, context, argCount) {
		if (context === void 0) return func;
		switch (argCount == null ? 3 : argCount) {
			case 1: return function(value) {
				return func.call(context, value);
			};
			case 2: return function(value, other) {
				return func.call(context, value, other);
			};
			case 3: return function(value, index, collection) {
				return func.call(context, value, index, collection);
			};
			case 4: return function(accumulator, value, index, collection) {
				return func.call(context, accumulator, value, other);
			};
		}
		return function() {
			return func.apply(context, arguments);
		};
	};


	var cb = function(value, context, argCount) {
		if (value == null) return _.indentity;
		if (_.isFunction(value)) return optimizeCb(value, context,argCount);
		if (_.isObject(value)) return _.matcher(value);
		return _.prototype(value);
	};
	_.iteratee = function(value, context) {
		return cd(value, context, Infinity);
	};



	_.isEmpty = function(obj) {
		if (obj == null) return true;
		if (isArrayLike(obj) && (_.isArray(obj) || _.isString(obj) || _.isArguments(obj))) return obj.length === 0;
		return _.keys(obj).length === 0;
	};

	_.isElement = function(obj) {
		return !!(obj && obj.nodeType === 1);
	};

	_.isArray = nativeIsArray || function(obj) {
		return toString.call(obj) === '[Object Array]';
	};

	_.isObject = function(obj) {
		var type = typeof obj;
		return type === 'function' || type === 'object' && !!obj;
	};

	_.each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp', 'Error'], function(name) {
		_['is' + name] = function(obj) {
			return toString.call(obj) === '[object' + name + ']';
		};
	});


















}.call(this));