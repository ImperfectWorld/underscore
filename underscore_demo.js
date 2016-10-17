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

    // 核心函数
    // `_` 其实是一个构造函数
    // 支持无 new 调用的构造函数（思考 jQuery 的无 new 调用）
    // 将传入的参数（实际要操作的数据）赋值给 this._wrapped 属性
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

    // 将一个对象的 key-value 键值对颠倒
    // 即原来的 key 为 value 值，原来的 value 值为 key 值
    // 需要注意的是，value 值不能重复（不然后面的会覆盖前面的）
    // 且新构造的对象符合对象构造规则
    // 并且返回新构造的对象
    _.invert = function (obj) {
        //返回新的对象
        var result = {};
        var keys = _.keys(obj);
        for (var i = 0, length = keys.length; i < length; i++) {
            result[obj[keys[i]]] = keys[i];
        }
        return result;
    };
    // created object.
    // 给定 prototype
    // 以及一些 own properties
    // 构造一个新的对象并返回
    _.create = function (prototype, props) {
        var result = baseCreate(prototype);

        //将props的键值对覆盖result对象
        if (props) _.extendOwn(result, props);
        return result;
    };

    // 传入一个对象
    // 遍历该对象的键值对（包括 own properties 以及 原型链上的）
    // 如果某个 value 的类型是方法（function），则将该 key 存入数组
    // 将该数组排序后返回
    _.functions = _.methods = function (obj) {
        // 返回的数组
        var names = [];

        // if IE < 9
        // 且对象重写了 `nonEnumerableProps` 数组中的某些方法
        // 那么这些方法名是不会被返回的
        // 可见放弃了 IE < 9 可能对 `toString` 等方法的重写支持
        for (var key in obj) {
            // 如果某个key对应的value值类型是函数
            // 则将这个key值存入数组
            if (_.isFunction(obj[key])) names.push(key);
        }

        //返回排序后的数组
        return names.sort();
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

    // 将几个对象上（第二个参数开始，根据参数而定）的所有键值对添加到 destination 对象（第一个参数）上
    // 因为 key 值可能会相同，所以后面的（键值对）可能会覆盖前面的
    // 参数个数 >= 1
    _.extend = createAssigner(_.allKeys);

    // Assigns a given object with all the own properties in the passed-in object(s)
    // (https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)
    // 跟 extend 方法类似，但是只把 own properties 拷贝给第一个参数对象
    // 只继承 own properties 的键值对
    // 参数个数 >= 1
    _.extendOwn = _.assign = createAssigner(_.keys);


    // 根据一定的需求（key 值，或者通过 predicate 函数返回真假）
    // 返回拥有一定键值对的对象副本
    // 第二个参数可以是一个 predicate 函数
    // 也可以是 >= 0 个 key
    // _.pick(object, *keys)
    // Return a copy of the object
    // filtered to only have values for the whitelisted keys (or array of valid keys)
    // Alternatively accepts a predicate indicating which keys to pick.
    /*
     _.pick({name: 'moe', age: 50, userid: 'moe1'}, 'name', 'age');
     => {name: 'moe', age: 50}
     _.pick({name: 'moe', age: 50, userid: 'moe1'}, ['name', 'age']);
     => {name: 'moe', age: 50}
     _.pick({name: 'moe', age: 50, userid: 'moe1'}, function(value, key, object) {
     return _.isNumber(value);
     });
     => {age: 50}
     */
    _.pick = function (object, oiteratee, context) {
        var result = {}, obj = object, iteratee, keys;

        //容错
        if (obj == null) return result;

        //如果第二个参数是函数
        if (_.isFunction(oiteratee)) {
            keys = _.allKeys(obj);
            iteratee = optimizeCb(oiteratee, context);
        } else {
            // 如果第二个参数不是函数
            // 则后面的 keys 可能是数组
            // 也可能是连续的几个并列的参数
            // 用 flatten 将它们展开
            keys = flatten(arguments, false, false, 1);

            //也转为predicate函数判断形式
            //将指定key 转化为predicate函数
            iteratee = function (value, key, obj) {
                return key in obj;
            };
            obj = Object[obj];
        }

        for (var i = 0, length = keys.length; i < length; i++) {
            var key = keys[i];
            var value = obj[key];
            if (iteratee(value, key, obj)) result[key] = value;
        }
        return result;
    };

    // 跟 _.pick 方法相对
    // 返回 _.pick 的补集
    // 即返回没有指定 keys 值的对象副本
    // 或者返回不能通过 predicate 函数的对象副本
    _.omit = function (obj, iteratee, context) {
        if (_.isFunction(iteratee)) {
            iteratee = _.negate(iteratee);
        } else {
            var keys = _.map(flatten(arguments, false, false, 1), String);
            iteratee = function (value, key) {
                return !_.contains(keys, key);
            };
        }
        return _.pick(obj, iteratee, context);
    };

    // 和 _.extend 非常类似
    // 区别是如果 *defaults 中出现了和 object 中一样的键
    // 则不覆盖 object 的键值对
    // 如果 *defaults 多个参数对象中有相同 key 的对象
    // 则取最早出现的 value 值
    // 参数个数 >= 1
    _.defaults = createAssigner(_.allkeys, true);

    // 对象的 `浅复制` 副本
    // 注意点：所有嵌套的对象或者数组都会跟原对象用同一个引用
    // 所以是为浅复制，而不是深度克隆
    _.clone = function (object) {
        // 容错 如果不是对象或者数组类型，则可以直接返回
        // 因为一些基础类型是直接按值传递的
        // 思考 arguments ？ Nodelists ？
        if (!_.isObject(obj)) return obj;

        // 如果是数组，则用 obj.slice()返回数组副本
        // 如果是对象，则提取所有 obj 的键值对覆盖空对象，返回
        return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
    };
    // 主要是用在链式调用中
    // 对中间值立即进行处理
    _.tap = function (obj, interceptor) {
        interceptor(obj);
        return obj;
    };

    // 判断对象中是否有指定 key
    // 等同于object.hasOwnProperty(key)
    _.has = function(obj, key) {
        return obj != null && hasOwnProperty.call(obj, key);
    };
    
    //判断一个给定的对象是否有某些键值对
    _.matcher = _.matches = function (attrs) {
        attrs = _.extendOwn({}, attrs);

        return function (obj) {
            return _.isMatch(obj, attrs);
        };
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

    _.property = property;
    
    _.propertyOf = function (obj) {
        return obj == null ? function () {} : function (key) {
            return obj[key];
        }
    };

    // 判断两个对象是否一样
    // new Boolean(true)，true 被认为 equal
    // [1, 2, 3], [1, 2, 3] 被认为 equal
    // 0 和 -0 被认为 unequal
    // NaN 和 NaN 被认为 equal
    _.isEqual = function (a, b) {
        return eq(a, b);
    };

    _.isEmpty = function(obj) {
        if (obj == null) return true;
        if (isArrayLike(obj) && (_.isArray(obj) || _.isString(obj) || _.isArguments(obj))) return obj.length === 0;
        return _.keys(obj).length === 0;
    };

    // attrs 参数为一个对象
    // 判断 object 对象中是否有 attrs 中的所有 key-value 键值对
    // 返回布尔值
    _.isMatch = function (object, attrs) {
       // 提取attrs对象的所有keys
        var keys = _.keys(attrs), length = keys.length;

        // 如果object为空
        // 根据 attrs 的键值对数量返回布尔值
        if (object == null) return !length;

        var obj = Object(object);

        for (var i = 0; i < length; i++) {
            var key = keys[i];

            // 如果 obj 对象没有 attrs 对象的某个 key
            // 或者对于某个 key，它们的 value 值不同
            // 则证明 object 并不拥有 attrs 的所有键值对
            // 则返回 false
            if (attrs[key] != obj[key] || !(key in obj)) return false;
        }
        return true;
    };

    // 判断是否为 DOM 元素
    _.isElement = function (obj) {
        // 确保 obj 不是 null, undefined 等假值
        // 并且 obj.nodeType === 1
        return !!(obj && obj.nodeType === 1);
    };
    
    // 判断是否是数组
    _.isArray = nativeIsArray || function (obj) {
        return toString.call(obj) === '[object Array]';
    };


   // 判断是否是对象
   // JavaScript数组和函数是对象，字符串和数字不是
    _.isObject = function (obj) {
        var type = typeof obj;
        return type === 'function' || type === 'object' && !!obj;
    };


    _.each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp', 'Error'], function(name) {
        _['is' + name] = function(obj) {
            return toString.call(obj) === '[object' + name + ']';
        };
    });

    // _.isArguments 方法在 IE < 9 下的兼容
    // IE < 9 下对 arguments 调用 Object.prototype.toString.call 方法
    // 结果是 => [object Object]
    // 而并非我们期望的 [object Arguments]。
    // so 用是否含有 callee 属性来做兼容
    if (!_.isArguments(arguments)) {
        _.isArguments = function (obj) {
            return _.has(obj, 'callee');
        };
    }

    // _.isFunction 在 old v8, IE 11 和 Safari 8 下的兼容
    // 这个我不懂！！！！
    // 我用的 chrome 49 (显然不是 old v8)
    // 却也进入了这个 if 判断内部
    if (typeof /./ != 'function' && typeof Int8Array != 'object') {
        _.isFunction = function (obj) {
            return typeof obj == 'function' || false;
        };
    }


    // 如果obj是一个有限数字，返回true；
    _.isFinite = function (obj) {
        return isFinite(obj) && !isNaN(parseFloat(obj));
    };

    /*   传送门 isFinite(testValue)
     isFinite(Infinity);  // false
     isFinite(NaN);       // false
     isFinite(-Infinity); // false

     isFinite(0);         // true
     isFinite(2e64);      // true
     isFinite(null);      // true


     isFinite("0");       // true, would've been false with the
     // more robust Number.isFinite("0")
     */

    // 判断是否是布尔值
    // 基础类型（true、 false）
    // 以及 new Boolean() 两个方向判断
    // 有点多余了吧？
    // 个人觉得直接用 toString.call(obj) 来判断就可以了
    _.isBoolean = function (obj) {
        return obj === true || obj === false || toString.call(obj) === '[object Boolean]';
    };

    // 判断是否是 NaN
    // NaN 是唯一的一个 `自己不等于自己` 的 number 类型
    // 这样写有 BUG
    // _.isNaN(new Number(0)) => true
    // 详见 https://github.com/hanzichi/underscore-analysis/issues/13
    // 最新版本（edge 版）已经修复该 BUG
    _.isNaN = function (obj) {
        return _.isNumber(obj) && obj !== +obj;
    };

    // 判断是否是 null
    _.isNull = function (obj) {
        return obj === null;
    };

    // 判断是否是 undefined
    // undefined 能被改写 （IE < 9）
    // undefined 只是全局对象的一个属性
    // 在局部环境能被重新定义
    // 但是 void 0 始终是 undefined
    _.isUndefined = function (value) {
        return obj === void 0;
    };




    // Array Functions
    // 数组的扩展方法
    // 共 20 个扩展方法
    // Note: All array functions will also work on the arguments object.
    // However, Underscore functions are not designed to work on "sparse" arrays.
    // ---------------

    // 返回数组第一个元素
    // 如果有参数 n，则返回数组前 n 个元素（组成的数组）
    _.first = _.head = _.take = function (array, n, guard) {
        // 容错，数组为空则返回 undefined
        if (array == null) return void 0;

        // 没有指定参数n，则返回第一个元素
        if (n == null || guard) return array[0];

        // 如果传入参数 n ，则返回前n个元素组成的数组
        // 返回前n个元素，即剔除后array.length - n 个元素
        return _.initial(array, array.length - n);
    };

    // 传入一个数组
    // 返回剔除最后一个元素之后的数组副本
    // 如果传入参数 n，则剔除最后 n 个元素
    _.initial = function (array, n, guard) {
        return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
    };

    // 返回数组最后一个元素
    // 如果传入参数 n
    // 则返回该数组后 n 个元素组成的数组
    // 即剔除前 array.length - n 个元素
    _.last = function (array, n, guard) {
        //容错
        if (array == null) return void 0;

        // 如果没有指定参数N，则返回最后一个元素
        if (n == null) return array[array.length - 1];

        // 如果传入参数N，则返回后n个元素组成的数组
        // 既剔除前array.length - n 个元素
        return _.rest(array, Math.max(0, array.length - n));
    };

    // 传入一个数组
    // 返回剔除第一个元素后的数组副本
    // 如果传入参数 n，则剔除前 n 个元素
    _.rest = _.tail = _.drop = function (array, n,guard) {
        return slice.call(array, n == null || guard ? 1 : n);
    };

    // 去掉数组中所有的假值
    // 返回数组副本
    // JavaScript 中的假值包括 false、null、undefined、''、NaN、0
    // 联想 PHP 中的 array_filter() 函数
    // _.identity = function(value) {
    //   return value;
    // };
    _.compact = function (array) {
        return _.filter(array, _.identity);
    };

    // 递归调用数组，将数组展开
    // 即 [1, 2, [3, 4]] => [1, 2, 3, 4]
    // flatten(array, shallow, false)
    // flatten(arguments, true, true, 1)
    // flatten(arguments, true, true)
    // flatten(arguments, false, false, 1)
    // ===== //
    // input => Array 或者 arguments
    // shallow => 是否只展开一层
    // strict === true，通常和 shallow === true 配合使用
    // 表示只展开一层，但是不保存非数组元素（即无法展开的基础类型）
    // flatten([[1, 2], 3, 4], true, true) => [1, 2]
    // flatten([[1, 2], 3, 4], false, true) = > []
    // startIndex => 从 input 的第几项开始展开
    // ===== //
    // 可以看到，如果 strict 参数为 true，那么 shallow 也为 true
    // 也就是展开一层，同时把非数组过滤
    // [[1, 2], [3, 4], 5, 6] => [1, 2, 3, 4]
    var flatten = function (input, shallow, strict, startIndex) {
        // output 数组保存结果
        // 即 flatten 方法返回数据
        // idx 为 output 的累计数组下标
        var output = [], idx = 0;

        // 根据startIndex 变量确定需要展开的起始位置
        for (var i = startIndex || 0, length = getLength(input); i < length; i++) {
            var value = input[i];

            if (isArrayLike(value) && _.isArray(value) || _.isArguments(value)) {
                // (!shallow === true) => (shallow === false)
                // 则表示需深度展开
                // 继续递归展开
                if (!shallow)
                    value = flatten(value, shallow, strict);

                // 递归展开到最后一层（没有嵌套的数组了）
                // 或者（shallow === true） =>只展开一层
                // value 值肯定是一个数组
                var j = 0, len = value.length;
                output.length += len;

                // 将value数组中的元素添加到output数组中
                while (j < len) {
                    output[idx++] = value[j++];
                }
            } else if (!strict) {
                // (!strict === true) => (strict === false)
                // 如果是深度展开，即 shallow 参数为 false
                // 那么当最后 value 不是数组，是基本类型时
                // 肯定会走到这个 else-if 判断中
                // 而如果此时 strict 为 true，则不能跳到这个分支内部
                // 所以 shallow === false 如果和 strict === true 搭配
                // 调用 flatten 方法得到的结果永远是空数组 []
                output[idx++] = value;
            }
        }

        return output;
    };

    // 将嵌套的数组展开
    // 如果参数 (shallow === true)，则仅展开一层
    // _.flatten([1, [2], [3, [[4]]]]);
    // => [1, 2, 3, 4];
    // ====== //
    // _.flatten([1, [2], [3, [[4]]]], true);
    // => [1, 2, 3, [[4]]];
    _.flatten = function (array, shallow) {
        // array => 需要展开的数组
        // shallow => 是否只展开一层
        // false 为 flatten 方法 strict 变量
        return flatten(array, shallow, false);
    };

    // _.without([1, 2, 1, 0, 3, 1, 4], 0, 1);
    // => [2, 3, 4]
    // ===== //
    // 从数组中移除指定的元素
    // 返回移除后的数组副本
    _.without = function (array) {
        return _.difference(array, slice.call(arguments, 1));
    };

    // 数组去重
    // 如果第二个参数 `isSorted` 为 true
    // 则说明事先已经知道数组有序
    // 程序会跑一个更快的算法（一次线性比较，元素和数组前一个元素比较即可）
    // 如果有第三个参数 iteratee，则对数组每个元素迭代
    // 对迭代之后的结果进行去重
    // 返回去重后的数组（array 的子数组）
    // PS: 暴露的 API 中没 context 参数
    // _.uniq(array, [isSorted], [iteratee])
    _.uniq = _.unique = function (array, isSorted, iteratee, context) {
        // 没有传入 isSorted 参数
        // 转为 _.unique(array, false, undefined, iteratee)
        if (!_.isBoolean(isSorted)) {
            context = iteratee;
            iteratee = isSorted;
            isSorted = false;
        }

        // 如果有迭代函数
        // 则根据this指向二次返回新的迭代函数
        if (iteratee != null) iteratee = cb(iteratee, context);

        // 结果数组，是array的子集
        var result = [];

        // 已经出现过的元素（或者经过迭代过的值）
        // 用来过滤重复值
        var seen = [];

        for (var i = 0, length = getLength(array); i < length; i++) {
            var value = array[i];
            // 如果指定了迭代函数
            // 则对数组每一个元素进行迭代
            // 迭代函数传入的三个参数通常是 value, index, array 形式
            // computed 保存当前元素
            computed = iteratee ? iteratee(value, i, array) : value;

            // 如果是有序数组，则当前元素只需跟上一个元素对比即可
            // 用 seen 变量保存上一个元素
            if (isSorted) {
                // 如果 i === 0，是第一个元素，则直接 push
                // 否则比较当前元素是否和前一个元素相等
                if (!i || seen !== computed) result.push(value);
                // seen 保存当前元素，供下一次对比
                seen = computed;
            }else if (iteratee) {
                // 如果 seen[] 中没有 computed 这个元素值
                if (!_.contains(seen, computed)) {
                    seen.push(computed);
                    result.push(value);
                }
            } else if (!_.contains(result, value)) {
                // 如果不用经过迭代函数计算，也就不用 seen[] 变量了
                result.push(value);
            }
        }

        return result;
    };

    // _.union([1, 2, 3], [101, 2, 1, 10], [2, 1]);
    // => [1, 2, 3, 101, 10]
    // ========== //
    // 将多个数组的元素集中到一个数组中
    // 并且去重，返回数组副本
    _.union = function () {
        // 首先用 flatten 方法将传入的数组展开成一个数组
        // 然后就可以愉快地调用 _.uniq 方法了
        // 假设 _.union([1, 2, 3], [101, 2, 1, 10], [2, 1]);
        // arguments 为 [[1, 2, 3], [101, 2, 1, 10], [2, 1]]
        // shallow 参数为 true，展开一层
        // 结果为 [1, 2, 3, 101, 2, 1, 10, 2, 1]
        // 然后对其去重
        return _.uniq(flatten(arguments, true, true));
    };

    // 寻找几个数组中共有的元素
    // 将这些每个数组中都有的元素存入另一个数组中返回
    // _.intersection(*arrays)
    // _.intersection([1, 2, 3, 1], [101, 2, 1, 10, 1], [2, 1, 1])
    // => [1, 2]
    // 注意：返回的结果数组是去重的
    // ----> 首先判断元素是否在结果数组中，有的话直接跳过，没有则进入下一步
    // ----> 再判断元素是否都在其他的数组中，如果发现有的数组中没有，则直接跳出for语句
    // ----> 遍历完成后都没有跳出，则证明所有数组都包含该元素，保存の
    _.intersection = function (array) {
        var result = [];
        var argsLength = arguments.length;

        // 遍历第一个数组的元素
        for (var i = 0, length = getLength(array); i < length; i++) {
            var item = array[i];

            // 如果 result[] 中已经有 item 元素了，continue
            // 即 array 中出现了相同的元素
            // 返回的 result[] 其实是个 "集合"（是去重的）
            if (_.contains(result, item)) continue;

            // 判断其他参数数组中是否都有item这个元素
            for (var j = 1; j < argsLength; j++) {
                if (!_.contains(arguments[j], item)) break;
            }

            // 遍历其他参数数组完毕
            // j === argsLength 说明其他参数都有这个元素
            // 则将该元素添加到result中
            if (j === argsLength) result.push(item);
        }

        return result;
    };

    // _.difference([1, 2, 3, 4, 5], [5, 2, 10]);
    // => [1, 3, 4]
    // ===== //
    // 剔除 array 数组中在 others 数组中出现的元素
    _.difference = function (array) {
        // 将 others 数组展开一层
        // rest[] 保存展开后的元素组成的数组
        // strict 参数为 true
        // 不可以这样用 _.difference([1, 2, 3, 4, 5], [5, 2], 10);
        // 10 就会取不到
        var rest = flatten(arguments, true, true, 1);

        return _.filter(array, function (value) {
            return !_.contains(rest, value);
        });
    };

    // _.zip(['moe', 'larry', 'curly'], [30, 40, 50], [true, false, false]);
    // => [["moe", 30, true], ["larry", 40, false], ["curly", 50, false]]
    // ===== //
    // 将多个数组中相同位置的元素归类
    // 返回一个数组
    _.zip = function() {
        return _.unzip(arguments);
    };

    // _.unzip([["moe", 30, true], ["larry", 40, false], ["curly", 50, false]]);
    // => [['moe', 'larry', 'curly'], [30, 40, 50], [true, false, false]]
    // ===== //
    _.unzip = function (array) {
        // _.max(array, getLength).length 返回array中最长数组的长度
        var length = array && _.max(array, getLength).length || 0;
        var result = Array(length);

        for (var index = 0; index < length; index++) {
            result[index] = _.pluck(array, index);
        }
        return result;
    };

    // 将数组转化为对象
    //_.object(['moe', 'larry', 'curly'], [30, 40, 50]);
    //=> {moe: 30, larry: 40, curly: 50}
    //_.object([['moe', 30], ['larry', 40], ['curly', 50]]);
    //=> {moe: 30, larry: 40, curly: 50}
    _.object = function (list, values) {
        var result = {};
        for (var i = 0, length = getLength(list); i < length; i++) {
            if (values) {
                return result[list[i]] = values[i];
            } else {
                result[list[i][0]] = list[i][1];
            }
        }
        return result;
    };

    // Generator function to create the indexOf and lastIndexOf functions
    // _.indexOf = createIndexFinder(1, _.findIndex, _.sortedIndex);
    // _.lastIndexOf = createIndexFinder(-1, _.findLastIndex);
    function createIndexFinder(dir, predicateFind, sortedIndex) {
        // API调用形式
        // _.indexOf = createIndexFinder(1, _.findIndex, _.sortedIndex)
        // _.indexOf = createIndexFinder(-1, _.findLastIndex)
        return function(array, item, idx) {
            var i = 0, length = getLength(array);

            // 如果 idx 为 Number 类型
            // 则规定查找位置的起始点
            // 那么第三个参数不是 [isSorted]
            // 所以不能用二分查找优化了
            // 只能遍历查找
            if (typeof idx == 'number') {
                if (dir > 0) { // 正向查找
                    // 重置查找的起始位置
                    i = idx >= 0 ? idx : Math.max(idx + length, i);
                } else { // 反向查找
                    // 如果是反向查找，重置 length 属性值
                    length = idx >= 0 ? Math.min(idx + 1, length) : idx + length + 1;
                }
            } else if (sortedIndex && idx && length) {
                // 能用二分查找加速的条件
                // 有序 & idx !== 0 && length !== 0

                // 用 _.sortIndex 找到有序数组中 item 正好插入的位置
                idx = sortedIndex(array, item);

                // 如果正好插入的位置的值和 item 刚好相等
                // 说明该位置就是 item 第一次出现的位置
                // 返回下标
                // 否则即是没找到，返回 -1
                return array[idx] === item ? idx : -1;
            }

            // 特判，如果要查找的元素是 NaN 类型
            // 如果 item !== item
            // 那么 item => NaN
            if (item !== item) {
                idx = predicateFind(slice.call(array, i, length), _.isNaN);
                return idx >= 0 ? idx + i : -1;
            }

            // O(n) 遍历数组
            // 寻找和 item 相同的元素
            // 特判排除了 item 为 NaN 的情况
            // 可以放心地用 `===` 来判断是否相等了
            for (idx = dir > 0 ? i : length - 1; idx >= 0 && idx < length; idx += dir) {
                if (array[idx] === item) return idx;
            }

            return -1;
        };

    };

    // _.indexOf(array, value, [isSorted])
    // 找到数组 array 中 value 第一次出现的位置
    // 并返回其下标值
    // 如果数组有序，则第三个参数可以传入 true
    // 这样算法效率会更高（二分查找）
    // [isSorted] 参数表示数组是否有序
    // 同时第三个参数也可以表示 [fromIndex] （见下面的 _.lastIndexOf）
    _.indexOf = createIndexFinder(1, _.findIndex, _.sortedIndex);

    // 和 _indexOf 相似
    // 反序查找
    // _.lastIndexOf(array, value, [fromIndex])
    // [fromIndex] 参数表示从倒数第几个开始往前找
    _.lastIndexOf = createIndexFinder(-1, _.findLastIndex);


    // ===== //
    // _.sortedIndex([10, 20, 30, 40, 50], 35);
    // => 3
    // ===== //
    // var stooges = [{name: 'moe', age: 40}, {name: 'curly', age: 60}];
    // _.sortedIndex(stooges, {name: 'larry', age: 50}, 'age');
    // => 1
    // ===== //
    // 二分查找
    // 将一个元素插入已排序的数组
    // 返回该插入的位置下标
    // _.sortedIndex(list, value, [iteratee], [context])
    _.sortedIndex = function (array, obj, iteratee, context) {
        // 注意 cb 方法
        // iteratee 为空 || 为 String 类型（key 值）时会返回不同方法
        iteratee = cb(iteratee, context, 1);

        // 经过迭代函数计算的值
        // 可打印 iteratee 出来看看
        var value = iteratee(obj);
        var low = 0, high = getLength(array);

        // 二分查找
        while (low < high) {
            var mid = Math.floor((low + high) / 2);
            if (iteratee(array[mid]) < value)
                low = mid + 1;
            else
                high = mid;
        }

        return low;
    };

    // 返回某一个范围内的数组成的数组
    _.range = function (start, stop, step) {
        if (stop == null) {
            stop = start || 0;
            strat = 0;
        }

        step = step || 1;

        // 返回数组的长度
        var length = Math.max(Math.ceil((stop - start) / step), 0);

        // 返回的数组
        var range = Array(length);

        for (var idx = 0; idx < length; idx++, start += step) {
            range[idx] = start;
        }

        return range;
    };






    // Function (ahem) Functions
    // 函数的扩展方法
    // 共 14 个扩展方法
    // ------------------

    var executeBound = function(sourceFunc, boundFunc, context, callingContext, args) {
        // 非 new 调用 _.bind 返回的方法（即 bound）
        // callingContext 不是 boundFunc 的一个实例
        if (!(callingContext instanceof boundFunc))
            return sourceFunc.apply(context, args);

        // 如果是用 new 调用 _.bind 返回的方法

        // self 为 sourceFunc 的实例，继承了它的原型链
        // self 理论上是一个空对象（还没赋值），但是有原型链
        var self = baseCreate(sourceFunc.prototype);

        // 用 new 生成一个构造函数的实例
        // 正常情况下是没有返回值的，即 result 值为 undefined
        // 如果构造函数有返回值
        // 如果返回值是对象（非 null），则 new 的结果返回这个对象
        // 否则返回实例
        // @see http://www.cnblogs.com/zichi/p/4392944.html
        var result = sourceFunc.apply(self, args);

        // 如果构造函数返回了对象
        // 则 new 的结果是这个对象
        // 返回这个对象
        if (_.isObject(result)) return result;

        // 否则返回 self
        // var result = sourceFunc.apply(self, args);
        // self 对象当做参数传入
        // 会直接改变值
        return self;
    };



    // ES5 bind 方法的扩展（polyfill）
    // 将 func 中的 this 指向 context（对象）
    // _.bind(function, object, *arguments)
    // 可选的 arguments 参数会被当作 func 的参数传入
    // func 在调用时，会优先用 arguments 参数，然后使用 _.bind 返回方法所传入的参数
    _.bind = function (func, conotext) {
        // 如果浏览器支持 ES5 bind 方法，并且 func 上的 bind 方法没有被重写
        // 则优先使用原生的 bind 方法
        if (nativeBind && func.bind === nativeBind)
            return nativeBind.apply(func, slice.call(arguments, 1));

        // 如果传入的参数func不是方法，则抛出错误
        if (!_.isFunction(func))
            throw new TypeError('Bind must be called on a function');

        // polyfill
        // 经典闭包，函数返回函数
        // args 获取优先使用的参数
        var args = slice.call(arguments, 2);
        var bound = function () {
            return executeBound(func, bound, context, this, args.concat(slice.call(arguments)));
        };

        return bound;
    }






    // "内部的"/ "递归地"/ "比较"
    // 该内部方法会被递归调用
    var eq = function (a, b, aStack, bStack) {
        // a === b 时
        // 需要注意 `0 === -0` 这个 special case
        // 0 和 -0 被认为不相同（unequal）
        if (a === b) return a !== 0 || 1 / a === 1 / b;

        // 如果 a 和 b 有一个为 null（或者 undefined）
        // 判断 a === b
        if (a == null || b == null) return a === b;

        // 如果 a 和 b 是 underscore OOP 的对象
        // 那么比较 _wrapped 属性值（Unwrap）
        if (a instanceof _) a = a._wrapped;
        if (b instanceof _) b = b._wrapped;

        // Compare `[[Class]]` names.
        // 用 Object.prototype.toString.call 方法获取 a 变量类型
        var className = toString.call(a);

        // 如果 a 和 b 类型不相同，则返回 false
        // 类型都不同了还比较个蛋！
        if (className !== toString.call(b)) return false;

        switch (className) {
            // Strings, numbers, regular expressions, dates, and booleans are compared by value.
            // 以上五种类型的元素可以直接根据其 value 值来比较是否相等
            case '[object RegExp]':
            case '[object String]':
                // 转为String类型进行比较
                return '' + a === '' + b;

            // RegExp 和 String 可以看做一类
            // 如果 obj 为 RegExp 或者 String 类型
            // 那么 '' + obj 会将 obj 强制转为 String
            // 根据 '' + a === '' + b 即可判断 a 和 b 是否相等
            // ================

            case '[object Date]':
            case '[object Boolean]':
                return +a === +b;

            // Date 和 Boolean 可以看做一类
            // 如果 obj 为 Date 或者 Boolean
            // 那么 +obj 会将 obj 转为 Number 类型
            // 然后比较即可
            // +new Date() 是当前时间距离 1970 年 1 月 1 日 0 点的毫秒数
            // +true => 1
            // +new Boolean(false) => 0
        }

    }











}.call(this));