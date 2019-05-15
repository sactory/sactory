var Sactory = {};

/**
 * @class
 * @since 0.42.0
 */
function Observable(value) {
	this.internal = {
		value: this.replace(value),
		snaps: {},
		count: 0,
		subscriptions: {}
	};
}

Observable.prototype.replace = function(value){
	if(value && (value.constructor === Array || value.constructor === ObservableArray)) {
		return new ObservableArray(this, value);
	} else {
		return value;
	}
};

Observable.prototype.updateImpl = function(value, type){
	var oldValue = this.internal.value;
	this.internal.value = value;
	for(var i in this.internal.subscriptions) {
		this.internal.subscriptions[i](value, oldValue, type);
	}
};

/**
 * @since 0.42.0
 */
Observable.prototype.update = function(value, type){
	this.updateImpl(arguments.length ? this.replace(value) : this.internal.value, type);
};

/**
 * @since 0.49.0
 */
Observable.prototype.snap = function(id){
	this.internal.snaps[id] = this.internal.value;
};

/**
 * @since 0.49.0
 */
Observable.prototype.snapped = function(id){
	return id in this.internal.snaps ? this.internal.snaps[id] : this.internal.value;
};

/**
 * @since 0.42.0
 */
Observable.prototype.subscribe = function(callback){
	var id = this.internal.count++;
	var subs = this.internal.subscriptions;
	this.internal.subscriptions[id] = callback;
	return {
		to: this,
		dispose: function(){
			delete subs[id];
		}
	};
};

Observable.prototype.toJSON = function(){
	return this.internal.value && this.internal.value.toJSON ? this.internal.value.toJSON() : this.internal.value;
};

/**
 * @since 0.42.0
 */
Object.defineProperty(Observable.prototype, "value", {
	get: function(){
		return this.internal.value;
	},
	set: function(value){
		this.update(value);
	}
});

/**
 * @class
 * @since 0.54.0
 */
function SavedObservable(defaultValue, storage) {
	if(storage.get) {
		var ret = storage.get(defaultValue);
		Observable.call(this, this.handleReturn(ret) ? defaultValue : ret);
	} else {
		Observable.call(this, defaultValue);
	}
	this.internal.storage = storage;
}

SavedObservable.prototype = Object.create(Observable.prototype);

if(typeof Promise == "function") {
	SavedObservable.prototype.handleReturn = function(ret){
		if(ret instanceof Promise) {
			var $this = this;
			ret.then(function(value){
				// do not call this.updateImpl to avoid saving
				Observable.prototype.updateImpl.call($this, value);
			});
			return true;
		} else {
			return false;
		}
	};
} else {
	SavedObservable.prototype.handleReturn = function(){
		return false;
	};
}

SavedObservable.prototype.updateImpl = function(value, type){
	this.internal.storage.set(value);
	Observable.prototype.updateImpl.call(this, value, type);
};

/**
 * @class
 * @since 0.52.0
 */
function ObservableArray(observable, value) {
	Array.call(this);
	Array.prototype.push.apply(this, value);
	Object.defineProperty(this, "observable", {
		enumerable: false,
		value: observable
	});
}

ObservableArray.prototype = Object.create(Array.prototype);

Object.defineProperty(ObservableArray.prototype, "length", {
	configurable: false,
	enumerable: false,
	writable: true,
	value: 0
});

["copyWithin", "fill", "pop", "push", "reverse", "shift", "sort", "splice", "unshift"].forEach(function(fun){
	if(Array.prototype[fun]) {
		Object.defineProperty(ObservableArray.prototype, fun, {
			enumerable: false,
			value: function(){
				var ret = Array.prototype[fun].apply(this, arguments);
				this.observable.update();
				return ret;
			}
		});
	}
});

ObservableArray.prototype.toJSON = function(){
	return Array.apply(null, this);
};

/**
 * @class
 * @since 0.54.0
 */
function StorageObservableProvider(storage, key) {
	this.storage = storage;
	this.key = key;
}

StorageObservableProvider.prototype.get = function(defaultValue){
	var item = this.storage.getItem(this.key);
	return item === null ? defaultValue : JSON.parse(item);
};

StorageObservableProvider.prototype.set = function(value){
	this.storage.setItem(this.key, JSON.stringify(value));
};

/**
 * @since 0.40.0
 */
Sactory.isObservable = function(value){
	return Sactory.isOwnObservable(value) || Sactory.isContainerObservable(value) || Sactory.isFunctionObservable(value);
};

/**
 * @since 0.42.0
 */
Sactory.isOwnObservable = function(value){
	return value instanceof Observable;
};

/**
 * @since 0.42.0
 */
Sactory.isContainerObservable = function(value){
	return value && value.observe && value.compute;
};

/**
 * @since 0.42.0
 */
Sactory.isFunctionObservable = function(value){
	return typeof value == "function" && value.subscribe;
};

/**
 * Subscribes to the observables and calls the callback with the current value.
 * @returns An array with the new subscriptions.
 * @since 0.40.0
 */
Sactory.observe = function(value, callback){
	var subscriptions = [];
	if(value instanceof Observable) {
		subscriptions.push(value.subscribe(callback));
		callback(value.value);
	} else if(value.subscribe) {
		subscriptions.push(value.subscribe(callback));
		callback(value());
	} else {
		function computed() {
			callback(value.compute());
		}
		value.observe.forEach(function(observable){
			subscriptions.push(observable.subscribe(computed));
		});
		computed();
	}
	return subscriptions;
};

/**
 * @deprecated Use {@link computedOf} instead.
 * @since 0.42.0
 */
Sactory.unobserve = function(value){
	if(Sactory.isContainerObservable(value)) {
		return value.compute();
	} else {
		return value;
	}
};

/**
 * @since 0.41.0
 */
Sactory.observable = function(value, storage, key){
	if(arguments.length > 1) {
		if(typeof storage == "object") {
			return new SavedObservable(value, storage);
		} else if(storage instanceof Storage) {
			return new SavedObservable(value, new StorageObservableProvider(storage, key));
		} else if(window.localStorage) {
			return new SavedObservable(value, new StorageObservableProvider(window.localStorage, storage));
		} else {
			console.warn("window.localStorage is unavailable. '" + key + "' will not be stored.");
		}
	}
	return new Observable(value);
};

/**
 * @since 0.48.0
 */
Sactory.computedObservable = function(bind, value){
	var ret = new Observable(value.compute());
	var subscriptions = [];
	value.observe.forEach(function(o){
		subscriptions.push(o.subscribe(function(){
			ret.value = value.compute();
		}));
	});
	if(bind) subscriptions.forEach(bind.subscribe);
	return ret;
};

module.exports = Sactory;
