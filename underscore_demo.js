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

    // underscore 内部方法
    // 根据 this 指向（context 参数）
    // 以及 argCount 参数
    // 二次操作返回一些回调、迭代方法
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
				return func.call(context, accumulator,  index, collection);
			};
		}
		return function() {
			return func.apply(context, arguments);
		};
	};


	var cb = function(value, context, argCount) {
		if (value == null) return _.identity;
		if (_.isFunction(value)) return optimizeCb(value, context, argCount);
		if (_.isObject(value)) return _.matcher(value);
		return _.prototype(value);
	};
	_.iteratee = function(value, context) {
		return cb(value, context, Infinity);
	};

    // An internal function for creating assigner functions.
    // 有三个方法用到了这个内部函数
    // _.extend & _.extendOwn & _.defaults
    // _.extend = createAssigner(_.allKeys);
    // _.extendOwn = _.assign = createAssigner(_.keys);
    // _.defaults = createAssigner(_.allKeys, true);
	var createAssigner = function(keysFunc, undefinedOnly) {
        // 返回函数
        // 经典闭包（undefinedOnly 参数在返回的函数中被引用）
        // 返回的函数参数个数 >= 1
        // 将第二个开始的对象参数的键值对 "继承" 给第一个参数
        return function(obj) {
            var length = arguments.length;
            // 只传入了一个参数（或者 0 个？）
            // 或者传入的第一个参数是 null
            if (length < 2 || obj == null) return obj;
            // 枚举第一个参数除外的对象参数
            // 即 arguments[1], arguments[2] ...
            for (var index = 1; index < length; index++) {
                // source 即为对象参数
                var source = arguments[index],
                    // 提取对象参数的 keys 值
                    // keysFunc 参数表示 _.keys
                    // 或者 _.allKeys
                    keys = keysFunc(source),
                    l = keys.length;

                // 遍历该对象的键值对
                for (var i = 0; i < l; i++) {
                    var key = keys[i];
                    // _.extend 和 _.extendOwn 方法
                    // 没有传入 undefinedOnly 参数，即 !undefinedOnly 为 true
                    // 即肯定会执行 obj[key] = source[key]
                    // 后面对象的键值对直接覆盖 obj
                    // ==========================================
                    // _.defaults 方法，undefinedOnly 参数为 true
                    // 即 !undefinedOnly 为 false
                    // 那么当且仅当 obj[key] 为 undefined 时才覆盖
                    // 即如果有相同的 key 值，取最早出现的 value 值
                    // *defaults 中有相同 key 的也是一样取首次出现的
                    if (!undefinedOnly || obj[key] === void 0) obj[key] = source[key];
                }
            }

            // 返回已经继承后面对象参数属性的第一个参数对象
            return obj;
        }
    };

    var baseCreate = function(prototype) {
        if (!_.isObject(prototype)) return {};
        if (nativeCreate) return nativeCreate(prototype);
        Ctor.prototype = prototype;
        var result = new Ctor;
        Ctor.prototype = null;
        return result;
    };

    var property = function(key) {
        return function(obj) {
            return obj == null ? void 0 : obj[key];
        };
    };


    var MAX_ARRAY_INDEX = Math.pow(2, 53) - 1;
    var getLength = property('length');
    var isArrayLike = function(collection) {
        var length = getLength(collection);
        return typeof length == 'number' && length >= 0 && length <= MAX_ARRAY_INDEX;
    };

    // Collection Functions
    // 数组或者对象的扩展方法
    // 共 25 个扩展方法
    // --------------------

    // 与 ES5 中 Array.prototype.forEach 使用方法类似
    // 遍历数组或者对象的每个元素
    // 第一个参数为数组（包括类数组）或者对象
    // 第二个参数为迭代方法，对数组或者对象每个元素都执行该方法
    // 该方法又能传入三个参数，分别为 (item, index, array)（(value, key, obj) for object）
    // 与 ES5 中 Array.prototype.forEach 方法传参格式一致
    // 第三个参数（可省略）确定第二个参数 iteratee 函数中的（可能有的）this 指向
    // 即 iteratee 中出现的（如果有）所有 this 都指向 context
    // notice: 不要传入一个带有 key 类型为 number 的对象！
    // notice: _.each 方法不能用 return 跳出循环（同样，Array.prototype.forEach 也不行）
    _.each = _.forEach = function(obj, iteratee, context) {
        // 根据 context 确定不同的迭代函数
        iteratee = optimizeCb(iteratee, context);
        var i, length;
        if (isArrayLike(obj)){
            for (i = 0, length = obj.length; i < length; i++) {
                iteratee(obj[i], i, obj);
            }
        } else {
            // 如果 obj 是对象
            // 获取对象的所有 key 值
            var keys = _.keys(obj);

            // 如果是对象，则遍历处理 values 值
            for (i = 0, length = keys.length; i < length; i++) {
                iteratee(obj[keys[i]], keys[i], obj);
            }
        }
        return obj;
    };

    // 与 ES5 中 Array.prototype.map 使用方法类似
    // 传参形式与 _.each 方法类似
    // 遍历数组（每个元素）或者对象的每个元素（value）
    // 对每个元素执行 iteratee 迭代方法
    // 将结果保存到新的数组中，并返回
    _.map = _.collect = function(obj, iteratee, context) {
        // 根据 iteratee 确定不同的迭代函数
        iteratee = cb(iteratee, context);

        // 如果传参是对象，则获取它的 keys 值数组（短路表达式）
        var keys = !isArrayLike(obj) && _.keys(obj),
            // 如果 obj 为对象，则 length 为 key.length
            // 如果 obj 为数组，则 length 为 obj.length
            length = (keys || obj).length,
            results = Array(length);
        for (var index = 0; index < length; index++) {
            var currentKey = keys ? keys[index] : index;
            results[index] = iteratee(obj[currentKey], currentKey, obj);
        }
        return results;
    };

    //dir === 1 -> _.reduce
    //dir === -1 -> _.reduceRight
    function createReduce(dir) {
        function iterator(obj, iteratee, memo, keys, index, length) {
            for (; index >= 0 && index < length; index += dir) {
                var currentKey = keys ? keys[index] : index;
                memo = iteratee(memo, obj[currentKey], currentKey, obj);
            }
            return memo;
        }

        // _.reduce可传入的4个参数
        // obj 数组或者对象
        // interatee 迭代方法，对数组或者对象每个元素执行该方法
        // memo 初始值， 如果有，则从obj第一个元素开始迭代
        // 如果没有，则从obj第二个元素开始迭代，将第一个元素作为初始值
        // context 为迭代函数中的this指向
        return function(obj, iteratee, memo, context) {
            iteratee = optimizeCb(iteratee, context, 4);
            var keys = !isArrayLike(obj) && _.keys(obj),
                length = (keys || obj).length,
                index = dir > 0 ? 0 : length - 1;
            if (arguments.length < 3) {
                memo = obj[keys ? keys[index] : index];
                index += dir;
            }
            return iterator(obj, iteratee, memo, keys, index, length);
        };
    }


    _.reduce = _.foldl = _.inject = createReduce(1);
    _.reduceRight = _.foldr = createReduce(-1);

    // 寻找数组或者对象中第一个满足条件（predicate 函数返回 true）的元素
    // 并返回该元素值
    _.find = _.detect = function(obj, predicate, context) {
        var key;
        if (isArrayLike(obj)) {
            key = _.findIndex(obj, predicate, context);
        } else {
            key = _.findKey(obj, predicate, context);
        }

        // 如果该元素存在，则返回该元素
        // 如果不存在，则默认返回 undefined（函数没有返回，即返回 undefined）
        if (key !== void 0 && key !== -1) return obj[key];
    };

    // 与 ES5 中 Array.prototype.filter 使用方法类似
    // 寻找数组或者对象中所有满足条件的元素
    // 如果是数组，则将 `元素值` 存入数组
    // 如果是对象，则将 `value 值` 存入数组
    // 返回该数组
    // _.filter(list, predicate, [context])
    _.filter = _.select = function(obj, predicate, context) {
        var results = [];

        //根据this的指向，返回predicate函数（判断函数）
        predicate = cb(predicate, context);

        //遍历每个元素，如果符合条件则存入数组
        _.each(obj, function(value, index, list) {
            if (predicate(value, index, list)) results.push(value);
        });

        return results;
    };


    // 寻找数组或者对象中所有不满足条件的元素
    // 并以数组方式返回
    // 所得结果是 _.filter 方法的补集
    _.reject = function(obj, predicate, context) {
        return _.filter(obj, _.negate(cb(predicate))， context);
    };











    // (dir === 1) => 从前往后找
    // (dir === -1) => 从后往前找
    function createPredicateIndexFinder(dir) {
        // 经典闭包
        return function(array, predicate, context) {
            predicate = cb(predicate, context);
            var length = getLength(array);

            //根据 dir 变量来确定数组遍历的起始位置
            var index = dir > 0 ? 0 : length - 1;

            for (; index >= 0 && index < length; index += dir) {
                // 找到第一个符合条件的元素
                // 返回下标值
                if (predicate(array[index], index, array)) return index;
            }
            return -1;
        };
    }

    _.findIndex = createPredicateIndexFinder(1);
    _.findLastIndex = createPredicateIndexFinder(-1);

    // 返回一个 predicate 方法的对立方法
    // 即该方法可以对原来的 predicate 迭代结果值取反
    _.negate = function (predicate) {
        return function() {
            return !predicate.apply(this, arguments);
        };
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


    //对象函数（Object Functions）



    // _.keys({one: 1, two: 2, three: 3});
    // => ["one", "two", "three"]
    // ===== //
    // 返回一个对象的 keys 组成的数组
    // 仅返回 own enumerable properties 组成的数组
    _.keys = function(obj) {
        //如果传入的参数不是对象，则返回空数组
        if (!_.isObject(obj)) return [];

        // 如果浏览器支持 ES5 Object.key() 方法
        //则优先使用该方法
        if (nativeKeys) return nativeKeys(obj);

        var keys = [];
        for (var key in obj)
            // hasOwnProperty
            if (_.has(obj, key)) keys.push(key);
        // IE < 9
        // IE < 9 下不能用 for in 来枚举某些 key 值
        // 传入keys 数组为参数
        // 在 js 下函数参数按值传递
        // 所以 keys 当做参数传入后会在 `collectNonEnumProps` 方法中改变值
        if (hasEnumBug) collectNonEnumProps(obj, keys);

        return keys;
    };


    // 返回一个对象的 keys 数组
    // 不仅仅是 own enumerable properties
    // 还包括原型链上继承的属性
    _.allKeys = function(obj) {
        if (!_.isObject(obj)) return [];

        var keys = [];
        for(var key in obj) keys.push(key);

        // Ahem, IE < 9.
        // IE < 9 下的 bug，同 _.keys 方法
        if (hasEnumBug) collectNonEnumProps(obj, keys);

        return keys;
    };

    // _.values({one: 1, two: 2, three: 3});
    // => [1, 2, 3]
    // ===== //
    // 将一个对象的所有 values 值放入数组中
    // 仅限 own properties 上的 values
    // 不包括原型链上的
    // 并返回该数组
    _.values = function(obj) {
        var keys = _.keys(obj);
        var length = keys.length;
        var values = Array(length);
        for (var i = 0; i < length; i++) {
            values[i] = obj[keys[i]];
        }
        return values;
    };

    // 跟 _.map 方法很像
    // 但是是专门为对象服务的 map 方法
    // 迭代函数改变对象的 values 值
    // 返回对象副本
    _.mapObject = function (obj, iteratee, context) {
        //迭代函数
        //对每个键值对进行迭代
        iteratee = cb(iteratee, context);

        var keys = _.keys(obj),
            length = keys.length,
            results = {}, // 对象副本，该方法返回的对象
            currentKey;

        for (var index = 0; index < length; index++) {
            currentKey = keys[index];

            //key值不变
            //对每个value 值用迭代函数进行迭代
            //返回经过函数运算后的值
            results[currentKey] = iteratee(obj[currentKey], currentKey, obj);
        }
        return results;
    };

    // 将一个对象转换为元素为 [key, value] 形式的数组
    // _.pairs({one: 1, two: 2, three: 3});
    // => [["one", 1], ["two", 2], ["three", 3]]
    _.pairs = function (obj) {
        var keys = _.keys(obj);
        var length = keys.length;
        var pairs = Array(length);
        for (var i = 0; i < length; i++) {
            pairs[i] = [keys[i], obj[keys[i]]];
        }
        return pairs;
    };

    // 跟数组方法的 _.findIndex 类似
    // 找到对象的键值对中第一个满足条件的键值对
    // 并返回该键值对 key 值
    _.findKey = function(obj, predicate, context) {
        predicate = cb(predicate, context);
        var keys = _.keys(obj), key;
        for (var i = 0, length = keys.length; i < length; i++) {
            key = keys[i];
            if (predicate(obj[key], key, obj)) return key;
        }
    };

    _.has = function(obj, key) {
        return obj != null && hasOwnProperty.call(obj, key);
    };

    _.identity = function(value) {
        return value;
    };

    _.matcher = _.matches = function(attrs) {
        attrs = _.extendOwn({}, attrs);
        return function(obj) {
            return _.isMatch(obj, attrs);
        };
    };


















}.call(this));